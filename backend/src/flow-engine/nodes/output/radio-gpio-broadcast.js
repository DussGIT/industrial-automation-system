const BaseNode = require('../base-node');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../../../core/database');
const { getGPIOManager } = require('../../../core/gpio-manager');
const { getActualFilePath } = require('../../../api/audio');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { getBroadcastQueue } = require('../../broadcast-queue');

/**
 * Radio GPIO Broadcast Node
 * Sets radio channel via GPIO, waits for clear channel, and plays audio
 */
class RadioGPIOBroadcastNode extends BaseNode {
  static type = 'radio-gpio-broadcast';

  constructor(config) {
    super(config);
    
    // Handle nested config structure - ReactFlow stores config at data.config
    const nodeConfig = config.data?.config || config.config || config;
    
    console.log('[RADIO GPIO BROADCAST CONSTRUCTOR] Raw config:', JSON.stringify(config, null, 2));
    console.log('[RADIO GPIO BROADCAST CONSTRUCTOR] Extracted nodeConfig:', JSON.stringify(nodeConfig, null, 2));
    console.log('[RADIO GPIO BROADCAST CONSTRUCTOR] audioSource will be:', nodeConfig.audioSource || 'file');
    
    this.radioId = nodeConfig.radioId || 'default'; // Radio profile ID
    this.audioSource = nodeConfig.audioSource || 'file'; // 'file' or 'tts'
    this.audioFileId = nodeConfig.audioFileId || null;
    this.ttsText = nodeConfig.ttsText || '';
    this.ttsVoice = nodeConfig.ttsVoice || 'en_US-lessac-medium';
    this.ttsSpeed = nodeConfig.ttsSpeed || '1.0';
    this.channel = nodeConfig.channel !== undefined ? parseInt(nodeConfig.channel) : 0;
    this.waitForClear = nodeConfig.waitForClear !== undefined ? nodeConfig.waitForClear : false; // Changed default to false
    this.clearChannelTimeout = nodeConfig.clearChannelTimeout || 5000; // ms
    this.repeat = nodeConfig.repeat || 1;
    
    const finalValues = {
      radioId: this.radioId,
      audioSource: this.audioSource,
      ttsText: this.ttsText,
      audioFileId: this.audioFileId
    };
    fs.writeFileSync('/tmp/radio-debug-final.json', JSON.stringify(finalValues, null, 2));
    
    this.gpio = getGPIOManager();
    this.broadcastQueue = getBroadcastQueue();
  }

  /**
   * Check if channel is clear by reading PTT input pin
   */
  async isChannelClear() {
    try {
      // Read the clear channel input pin (assumed to be configured in gpio-manager)
      // This would be connected to the radio's squelch/busy output
      const clearChannelPin = 23; // Configure as needed
      const value = await this.gpio.readPin(clearChannelPin);
      return value === 0; // Assuming active-low (0 = clear, 1 = busy)
    } catch (error) {
      this.log(`Failed to check clear channel: ${error.message}`, 'warn');
      return true; // Default to clear if we can't read
    }
  }

  /**
   * Wait for channel to be clear
   */
  async waitForClearChannel(timeout) {
    if (!this.waitForClear) {
      return true;
    }

    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms

    while (Date.now() - startTime < timeout) {
      if (await this.isChannelClear()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    return false; // Timeout
  }

  /**
   * Replace template variables in text with message data
   */
  replaceTemplateVariables(text, msg) {
    if (!text) return '';
    
    let result = text;
    
    // Replace {{variable}} patterns
    const regex = /\{\{([^}]+)\}\}/g;
    result = result.replace(regex, (match, variable) => {
      const key = variable.trim();
      
      // Support dot notation like msg.payload.temperature
      const parts = key.split('.');
      let value = msg;
      
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          // Variable not found, keep original
          return match;
        }
      }
      
      // Convert to string
      return value !== null && value !== undefined ? String(value) : match;
    });
    
    return result;
  }

  /**
   * Generate TTS audio file
   */
  async generateTTS(text, voice, speed) {
    try {
      const piperPath = process.env.PIPER_PATH || '/usr/local/bin/piper';
      const modelPath = process.env.PIPER_MODEL_PATH || '/usr/local/share/piper/models';
      const modelFile = path.join(modelPath, `${voice}.onnx`);
      
      // Generate temporary filename
      const tempFilename = `tts-broadcast-${Date.now()}.wav`;
      const audioDir = process.env.AUDIO_DIR || '/data/audio';
      const tempFilepath = path.join(audioDir, tempFilename);
      
      this.log(`Generating TTS: "${text.substring(0, 50)}..." with voice ${voice}`, 'info');
      
      // Generate TTS audio
      // Note: Piper's length_scale is inverse - higher = slower, lower = faster
      // So we invert the speed: if user wants 2x speed, we use 0.5 length_scale
      const lengthScale = speed > 0 ? (1.0 / parseFloat(speed)) : 1.0;
      const command = `echo "${text.replace(/"/g, '\\"')}" | ${piperPath} --model ${modelFile} --output_file ${tempFilepath} --length_scale ${lengthScale}`;
      await execPromise(command);
      
      this.log(`TTS generated: ${tempFilename}`, 'info');
      
      return tempFilepath;
    } catch (error) {
      throw new Error(`TTS generation failed: ${error.message}`);
    }
  }

  /**
   * Get audio duration in milliseconds from WAV file
   */
  getAudioDuration(filepath) {
    try {
      const stats = fs.statSync(filepath);
      // WAV format: assume 44.1kHz, 16-bit, mono (88,200 bytes per second)
      // For stereo: 176,400 bytes per second
      const headerSize = 44; // Standard WAV header
      const dataSize = stats.size - headerSize;
      
      // Calculate for both mono and stereo, use the more conservative (longer) estimate
      const durationMono = (dataSize / 88200) * 1000; // milliseconds
      const durationStereo = (dataSize / 176400) * 1000;
      
      // Use mono estimate (longer duration) for safety
      return Math.max(100, Math.round(durationMono));
    } catch (error) {
      this.log(`Failed to calculate audio duration: ${error.message}`, 'warn');
      return 1000; // Default 1 second fallback
    }
  }

  /**
   * Play audio file using aplay
   * Returns the total playback duration in milliseconds
   */
  async playAudio(filepath, repeatCount = 1) {
    try {
      // Use USB Audio Device (Card 1) - plughw handles format conversion
      const audioDevice = process.env.AUDIO_DEVICE || 'plughw:1,0';
      const singleDuration = this.getAudioDuration(filepath);
      
      for (let i = 0; i < repeatCount; i++) {
        this.log(`Playing audio (${i + 1}/${repeatCount}): ${path.basename(filepath)} (~${singleDuration}ms)`, 'info');
        try {
          await execPromise(`aplay -D ${audioDevice} "${filepath}"`);
        } catch (error) {
          this.log(`Audio playback failed (no audio device?): ${error.message}`, 'warn');
          // Simulate audio duration
          this.log(`Simulating audio duration: ${singleDuration}ms`, 'info');
          await new Promise(resolve => setTimeout(resolve, singleDuration));
        }
        
        // Small delay between repeats
        if (i < repeatCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Return total duration (including repeat delays)
      const totalDuration = (singleDuration * repeatCount) + (500 * Math.max(0, repeatCount - 1));
      return totalDuration;
    } catch (error) {
      throw new Error(`Failed to play audio: ${error.message}`);
    }
  }

  /**
   * Handle incoming messages by adding to global queue
   */
  async receive(msg) {
    const queueLength = this.broadcastQueue.getQueueLength();
    this.log(`Adding broadcast to global queue (current queue: ${queueLength})`, 'info');
    
    try {
      // Pass metadata for queue tracking
      const metadata = {
        nodeName: this.name || 'Radio Broadcast',
        channel: this.channel,
        audioSource: this.audioSource
      };
      
      await this.broadcastQueue.enqueue(() => this.processBroadcast(msg), metadata);
      this.log('Broadcast completed', 'info');
    } catch (error) {
      this.log(`Broadcast failed: ${error.message}`, 'error');
    }
  }

  /**
   * Process a single broadcast message
   */
  async processBroadcast(msg) {
    let tempTTSFile = null;
    
    try {
      console.log('[Radio GPIO Broadcast] Constructor values:', {
        audioSource: this.audioSource,
        audioFileId: this.audioFileId,
        ttsText: this.ttsText
      });
      
      // Allow dynamic configuration via message
      let audioSource = this.audioSource;
      let audioFileId = this.audioFileId;
      let ttsText = this.ttsText;
      let channel = this.channel;
      let repeat = this.repeat;

      if (msg.payload && typeof msg.payload === 'object') {
        if (msg.payload.audioSource) {
          audioSource = msg.payload.audioSource;
        }
        if (msg.payload.audioFileId) {
          audioFileId = msg.payload.audioFileId;
        }
        if (msg.payload.ttsText) {
          ttsText = msg.payload.ttsText;
        }
        if (msg.payload.channel !== undefined) {
          channel = parseInt(msg.payload.channel);
        }
        if (msg.payload.repeat !== undefined) {
          repeat = Math.max(1, Math.min(10, msg.payload.repeat));
        }
      }

      // Validate channel
      if (isNaN(channel) || channel < 0 || channel > 15) {
        throw new Error(`Invalid channel: ${channel}. Must be 0-15`);
      }

      let filepath;
      let audioName;

      console.log('[Radio GPIO Broadcast] Final audioSource value:', audioSource);

      // Handle audio source
      if (audioSource === 'tts') {
        // TTS mode
        console.log('[Radio GPIO Broadcast] TTS mode - ttsText:', ttsText);
        if (!ttsText || ttsText.trim().length === 0) {
          throw new Error('TTS text is required');
        }

        // Replace template variables
        const processedText = this.replaceTemplateVariables(ttsText, msg);
        this.log(`TTS text after template: "${processedText}"`, 'info');

        // Generate TTS
        tempTTSFile = await this.generateTTS(processedText, this.ttsVoice, this.ttsSpeed);
        filepath = tempTTSFile;
        audioName = `TTS: ${processedText.substring(0, 30)}...`;
      } else {
        // File mode
        console.error('[RADIO DEBUG receive] In file mode - audioSource:', audioSource, 'audioFileId:', audioFileId, 'ttsText:', ttsText);
        if (!audioFileId) {
          console.error('[RADIO DEBUG receive] Throwing error: Audio file is required');
          throw new Error('Audio file is required for broadcast');
        }

        // Get database
        const db = getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        // Get audio file from database
        const audioFile = db.prepare('SELECT * FROM audio_files WHERE id = ?').get(audioFileId);
        
        if (!audioFile) {
          throw new Error(`Audio file with ID ${audioFileId} not found`);
        }

        // Get actual file path (handles both old Windows paths and new Linux paths)
        filepath = getActualFilePath(audioFile.filepath, audioFile.filename);
        audioName = audioFile.name;

        // Check if file exists
        if (!fs.existsSync(filepath)) {
          throw new Error(`Audio file not found at path: ${filepath}`);
        }
      }

      this.log(`Starting radio broadcast on channel ${channel}: ${audioName}`, 'info');

      let pttActivated = false;

      try {
        // Step 1: Set radio channel
        this.log(`Setting radio channel to ${channel} (${this.radioId})`, 'info');
        const channelResult = await this.gpio.setChannel(channel, this.radioId);
        if (!channelResult) {
          throw new Error('Failed to set radio channel');
        }

        // Small delay to let radio settle
        await new Promise(resolve => setTimeout(resolve, 100));

        // Step 2: Wait for clear channel
        if (this.waitForClear) {
          this.log('Waiting for clear channel...', 'info');
          const isClear = await this.waitForClearChannel(this.clearChannelTimeout);
          if (!isClear) {
            throw new Error(`Channel ${channel} busy - timeout after ${this.clearChannelTimeout}ms`);
          }
          this.log('Channel is clear', 'info');
        }

        // Step 3: Activate PTT
        this.log(`Activating PTT (${this.radioId})`, 'info');
        const pttResult = await this.gpio.activatePTT(this.radioId);
        if (!pttResult) {
          throw new Error('Failed to activate PTT');
        }
        pttActivated = true;
        this.log('PTT activated successfully', 'info');

        // Delay for PTT to settle and radio to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 4: Play audio
        this.log('Starting audio playback', 'info');
        const totalAudioDuration = await this.playAudio(filepath, repeat);
        this.log('Audio playback complete', 'info');
        
        // Keep PTT active for buffer drain - use 30% of audio duration or min 500ms, max 2000ms
        const bufferDelay = Math.min(2000, Math.max(500, Math.round(totalAudioDuration * 0.3)));
        this.log(`Waiting ${bufferDelay}ms for audio buffer drain`, 'info');
        await new Promise(resolve => setTimeout(resolve, bufferDelay));

      } finally {
        // Step 5: Always deactivate PTT, even if there was an error
        if (pttActivated) {
          this.log(`Deactivating PTT (${this.radioId})`, 'info');
          await this.gpio.deactivatePTT(this.radioId);
          this.log('PTT deactivated', 'info');
        }
        
        // Clean up temporary TTS file
        if (tempTTSFile && fs.existsSync(tempTTSFile)) {
          try {
            fs.unlinkSync(tempTTSFile);
            this.log(`Cleaned up TTS file: ${path.basename(tempTTSFile)}`, 'info');
          } catch (err) {
            this.log(`Failed to clean up TTS file: ${err.message}`, 'warn');
          }
        }
      }

      // Send output message
      msg.payload = {
        action: 'radio_gpio_broadcast',
        channel: channel,
        audioSource: audioSource,
        audioName: audioName,
        repeat: repeat,
        success: true,
        timestamp: Date.now()
      };

      this.send(msg);
      this.log(`Broadcast complete: ${audioName} on channel ${channel}`, 'info');

    } catch (error) {
      // Clean up temp file on error too
      if (tempTTSFile && fs.existsSync(tempTTSFile)) {
        try {
          fs.unlinkSync(tempTTSFile);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
      
      this.error(`Broadcast failed: ${error.message}`, error);
    }
  }
}

module.exports = RadioGPIOBroadcastNode;
