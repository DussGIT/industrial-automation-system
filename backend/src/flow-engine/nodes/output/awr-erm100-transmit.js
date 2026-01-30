const BaseNode = require('../base-node');
const { getGPIOManager } = require('../../../core/gpio-manager');
const { getDb } = require('../../../core/database');
const { spawn } = require('child_process');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * AWR ERM100 Transmit Node
 * Transmits on the AWR ERM100 radio with channel selection and timing control
 * Supports audio files from library or text-to-speech
 */
class AWRERM100TransmitNode extends BaseNode {
  static type = 'awr-erm100-transmit';
  
  constructor(config) {
    super(config);
    const nodeConfig = config.data?.config || config;
    
    this.channel = nodeConfig.channel || 0;
    this.duration = nodeConfig.duration || 2000;
    this.preKeyDelay = nodeConfig.preKeyDelay || 100;
    this.postKeyDelay = nodeConfig.postKeyDelay || 100;
    this.mode = nodeConfig.mode || 'manual'; // 'manual', 'audio', 'tts'
    this.audioFileId = nodeConfig.audioFileId || null;
    this.ttsText = nodeConfig.ttsText || '';
    this.gpio = getGPIOManager();
    
    this.transmitting = false;
    this.piperPath = '/tmp/piper-test/piper/piper';
    this.piperModel = '/tmp/piper-test/en_US-lessac-medium.onnx';
  }

  async start() {
    // Node ready
  }

  async stop() {
    if (this.transmitting) {
      await this.gpio.deactivatePTT();
      this.transmitting = false;
    }
  }

  async receive(msg) {
    try {
      if (this.transmitting) {
        this.log('Already transmitting, message ignored', 'warn');
        return;
      }

      // Extract parameters from message or use node config
      const channel = msg.channel !== undefined ? msg.channel : this.channel;
      const mode = msg.mode || this.mode;
      let audioFilePath = null;
      let actualDuration = this.duration;

      // Set channel
      await this.gpio.setChannel(channel);
      await this.sleep(50);

      // Handle different modes
      if (mode === 'audio') {
        // Audio file mode
        const audioFileId = msg.audioFileId || this.audioFileId;
        if (!audioFileId) {
          throw new Error('Audio file ID required for audio mode');
        }

        const db = getDb();
        const audioFile = db.prepare('SELECT * FROM audio_files WHERE id = ?').get(audioFileId);
        if (!audioFile) {
          throw new Error(`Audio file with ID ${audioFileId} not found`);
        }
        if (!fs.existsSync(audioFile.filepath)) {
          throw new Error(`Audio file not found at path: ${audioFile.filepath}`);
        }

        audioFilePath = audioFile.filepath;
        // Use audio duration in seconds, convert to ms
        actualDuration = Math.ceil(audioFile.duration * 1000);
        this.log(`Playing audio: ${audioFile.name} (${actualDuration}ms)`, 'info');

      } else if (mode === 'tts') {
        // Text-to-speech mode
        const text = msg.ttsText || this.ttsText;
        if (!text) {
          throw new Error('Text required for TTS mode');
        }

        this.log(`Generating TTS for: "${text}"`, 'info');
        audioFilePath = await this.generateTTS(text);
        
        // Estimate duration based on text length (roughly 150 words per minute)
        const words = text.split(/\\s+/).length;
        actualDuration = Math.ceil((words / 150) * 60 * 1000) + 500; // Add 500ms buffer
        
      } else {
        // Manual mode - just key for specified duration
        actualDuration = msg.duration !== undefined ? msg.duration : this.duration;
      }

      // Pre-key delay
      if (this.preKeyDelay > 0) {
        await this.sleep(this.preKeyDelay);
      }

      this.transmitting = true;
      
      // Activate PTT
      await this.gpio.activatePTT();

      if (audioFilePath) {
        // Play audio while transmitting
        await this.playAudio(audioFilePath);
      } else {
        // Just hold PTT for duration
        await this.sleep(actualDuration);
      }

      // Deactivate PTT
      await this.gpio.deactivatePTT();
      this.transmitting = false;

      // Post-key delay
      if (this.postKeyDelay > 0) {
        await this.sleep(this.postKeyDelay);
      }

      // Cleanup TTS file if generated
      if (mode === 'tts' && audioFilePath) {
        try {
          fs.unlinkSync(audioFilePath);
        } catch (e) {
          this.log(`Failed to cleanup TTS file: ${e.message}`, 'warn');
        }
      }

      msg.payload = {
        success: true,
        channel,
        mode,
        duration: actualDuration,
        timestamp: Date.now()
      };
      this.send(msg);

    } catch (error) {
      this.transmitting = false;
      // Ensure PTT is released on error
      try {
        await this.gpio.deactivatePTT();
      } catch (pttError) {
        this.log(`Failed to deactivate PTT: ${pttError.message}`, 'error');
      }
      this.error(error);
      this.log(`Transmission failed: ${error.message}`, 'error');
    }
  }

  /**
   * Generate speech from text using Piper TTS
   * @param {string} text - Text to convert to speech
   * @returns {Promise<string>} Path to generated audio file
   */
  async generateTTS(text) {
    return new Promise((resolve, reject) => {
      const outputFile = `/tmp/tts-${Date.now()}.wav`;
      
      const piper = spawn(this.piperPath, [
        '--model', this.piperModel,
        '--output_file', outputFile
      ]);

      // Send text to stdin
      piper.stdin.write(text);
      piper.stdin.end();

      let stderr = '';
      piper.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      piper.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputFile)) {
          this.log(`TTS generated: ${outputFile}`, 'debug');
          resolve(outputFile);
        } else {
          this.log(`TTS generation failed: ${stderr}`, 'error');
          reject(new Error('TTS generation failed'));
        }
      });

      piper.on('error', (err) => {
        this.log(`TTS spawn error: ${err.message}`, 'error');
        reject(err);
      });
    });
  }

  /**
   * Play audio file
   * @param {string} filepath - Path to audio file
   * @returns {Promise<void>}
   */
  async playAudio(filepath) {
    return new Promise((resolve, reject) => {
      // Use aplay on Linux (UP Board)
      const command = `aplay "${filepath}"`;
      
      exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          this.log(`Audio playback error: ${error.message}`, 'error');
          reject(error);
          return;
        }
        
        if (stderr && !stderr.includes('ALSA')) {
          this.log(`Audio playback warning: ${stderr}`, 'warn');
        }
        
        resolve();
      });
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AWRERM100TransmitNode;
