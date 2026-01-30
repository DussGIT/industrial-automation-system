const BaseNode = require('../base-node');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../../../core/database');
const { getGPIOManager } = require('../../../core/gpio-manager');
const { getActualFilePath } = require('../../../api/audio');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Radio Broadcast Node - Broadcasts audio files over radio hardware
 */
class RadioBroadcastNode extends BaseNode {
  static type = 'radio-broadcast';

  constructor(config) {
    super(config);
    this.audioFileId = this.config.audioFileId || null;
    this.channel = this.config.channel !== undefined ? this.config.channel : 0; // Default channel 0
    this.repeat = this.config.repeat || 1;
    this.waitForClear = this.config.waitForClear !== false; // Default true
    this.clearChannelTimeout = this.config.clearChannelTimeout || 5000;
    this.gpio = getGPIOManager();
  }

  /**
   * Check if channel is clear by reading clear channel input pin
   */
  async isChannelClear() {
    try {
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
   * Play audio file using paplay (PulseAudio) to HDMI output
   */
  async playAudio(filepath, repeatCount = 1) {
    try {
      for (let i = 0; i < repeatCount; i++) {
        this.log(`Playing audio (${i + 1}/${repeatCount}): ${path.basename(filepath)}`, 'info');
        try {
          // Use aplay with HDMI device and fallbacks (same as audio-player node)
          const command = `aplay -D plughw:0,3 "${filepath}" 2>/dev/null || aplay "${filepath}" || paplay "${filepath}" || ffplay -nodisp -autoexit "${filepath}"`;
          await execPromise(command);
        } catch (error) {
          this.log(`Audio playback failed: ${error.message}`, 'warn');
          // Simulate audio duration by waiting based on file size
          const stats = fs.statSync(filepath);
          const estimatedDuration = Math.max(1000, Math.min(10000, stats.size / 10));
          this.log(`Simulating audio duration: ${estimatedDuration}ms`, 'info');
          await new Promise(resolve => setTimeout(resolve, estimatedDuration));
        }
        
        // Small delay between repeats
        if (i < repeatCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      return true;
    } catch (error) {
      throw new Error(`Failed to play audio: ${error.message}`);
    }
  }

  /**
   * Handle incoming messages
   */
  async receive(data) {
    try {
      // Allow dynamic configuration via message
      let audioFileId = this.audioFileId;
      let channel = this.channel;
      let repeat = this.repeat;
      let waitForClear = this.waitForClear;
      let clearChannelTimeout = this.clearChannelTimeout;

      if (data.payload && typeof data.payload === 'object') {
        if (data.payload.audioFileId) {
          audioFileId = data.payload.audioFileId;
        }
        if (data.payload.channel !== undefined) {
          channel = Math.max(0, Math.min(15, parseInt(data.payload.channel)));
        }
        if (data.payload.repeat !== undefined) {
          repeat = Math.max(1, Math.min(10, data.payload.repeat));
        }
        if (data.payload.waitForClear !== undefined) {
          waitForClear = data.payload.waitForClear;
        }
        if (data.payload.clearChannelTimeout !== undefined) {
          clearChannelTimeout = data.payload.clearChannelTimeout;
        }
      }

      // Validate
      if (!audioFileId) {
        throw new Error('Audio file is required for radio broadcast');
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
      const filepath = getActualFilePath(audioFile.filepath, audioFile.filename);

      // Check if file exists
      if (!fs.existsSync(filepath)) {
        throw new Error(`Audio file not found at path: ${filepath}`);
      }

      this.log(`Starting radio broadcast on channel ${channel}: ${audioFile.name}`, 'info');

      let pttActivated = false;

      try {
        // Step 1: Set radio channel
        this.log(`Setting radio channel to ${channel}`, 'info');
        const channelResult = await this.gpio.setChannel(channel);
        if (!channelResult) {
          throw new Error('Failed to set radio channel');
        }

        // Small delay to let radio settle
        await new Promise(resolve => setTimeout(resolve, 100));

        // Step 2: Wait for clear channel (if enabled)
        if (this.waitForClear) {
          this.log('Waiting for clear channel...', 'info');
          const isClear = await this.waitForClearChannel(clearChannelTimeout);
          if (!isClear) {
            throw new Error(`Channel ${channel} busy - timeout after ${clearChannelTimeout}ms`);
          }
          this.log('Channel is clear', 'info');
        }

        // Step 3: Activate PTT
        this.log('Activating PTT', 'info');
        const pttResult = await this.gpio.activatePTT();
        if (!pttResult) {
          throw new Error('Failed to activate PTT');
        }
        pttActivated = true;
        this.log('PTT activated successfully', 'info');

        // Small delay for PTT to settle
        await new Promise(resolve => setTimeout(resolve, 200));

        // Step 4: Play audio
        this.log('Starting audio playback', 'info');
        await this.playAudio(filepath, repeat);
        this.log('Audio playback complete', 'info');

      } finally {
        // Step 5: Always deactivate PTT, even if there was an error
        if (pttActivated) {
          this.log('Deactivating PTT', 'info');
          await this.gpio.deactivatePTT();
          this.log('PTT deactivated', 'info');
        }
      }

      // Send output message
      const output = {
        ...data,
        payload: {
          action: 'radio_broadcast',
          file: audioFile.name,
          format: audioFile.format,
          channel: channel,
          duration: audioFile.duration,
          repeat: repeat,
          success: true,
          timestamp: Date.now()
        }
      };

      this.send(output);
      this.log(`Radio broadcast complete: ${audioFile.name} on channel ${channel}`, 'info');

    } catch (error) {
      this.log(`Radio broadcast failed: ${error.message}`, 'error');
      
      // Emit error to UI
      if (this.io) {
        this.io.emit('flow:node-error', {
          nodeId: this.id,
          nodeName: this.name,
          error: error.message,
          timestamp: Date.now()
        });
      }
      
      // Send error output instead of throwing
      const errorOutput = {
        ...data,
        payload: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
      this.send(errorOutput);
    }
  }
}

module.exports = RadioBroadcastNode;
