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
 * Radio GPIO Broadcast Node
 * Sets radio channel via GPIO, waits for clear channel, and plays audio
 */
class RadioGPIOBroadcastNode extends BaseNode {
  static type = 'radio-gpio-broadcast';

  constructor(config) {
    super(config);
    
    // Handle nested config structure
    const nodeConfig = config.config || config;
    
    this.audioFileId = nodeConfig.audioFileId || null;
    this.channel = nodeConfig.channel !== undefined ? parseInt(nodeConfig.channel) : 0;
    this.waitForClear = nodeConfig.waitForClear !== undefined ? nodeConfig.waitForClear : false; // Changed default to false
    this.clearChannelTimeout = nodeConfig.clearChannelTimeout || 5000; // ms
    this.repeat = nodeConfig.repeat || 1;
    
    this.gpio = getGPIOManager();
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
   * Play audio file using aplay
   */
  async playAudio(filepath, repeatCount = 1) {
    try {
      for (let i = 0; i < repeatCount; i++) {
        this.log(`Playing audio (${i + 1}/${repeatCount}): ${path.basename(filepath)}`, 'info');
        try {
          await execPromise(`aplay "${filepath}"`);
        } catch (error) {
          this.log(`Audio playback failed (no audio device?): ${error.message}`, 'warn');
          // Simulate audio duration by waiting based on file size
          const stats = fs.statSync(filepath);
          const estimatedDuration = Math.max(1000, Math.min(10000, stats.size / 10)); // Rough estimate
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
  async receive(msg) {
    try {
      // Allow dynamic configuration via message
      let audioFileId = this.audioFileId;
      let channel = this.channel;
      let repeat = this.repeat;

      if (msg.payload && typeof msg.payload === 'object') {
        if (msg.payload.audioFileId) {
          audioFileId = msg.payload.audioFileId;
        }
        if (msg.payload.channel !== undefined) {
          channel = parseInt(msg.payload.channel);
        }
        if (msg.payload.repeat !== undefined) {
          repeat = Math.max(1, Math.min(10, msg.payload.repeat));
        }
      }

      // Validate
      if (!audioFileId) {
        throw new Error('Audio file is required for broadcast');
      }

      if (isNaN(channel) || channel < 0 || channel > 15) {
        throw new Error(`Invalid channel: ${channel}. Must be 0-15`);
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
      msg.payload = {
        action: 'radio_gpio_broadcast',
        channel: channel,
        file: audioFile.name,
        format: audioFile.format,
        duration: audioFile.duration,
        repeat: repeat,
        success: true,
        timestamp: Date.now()
      };

      this.send(msg);
      this.log(`Broadcast complete: ${audioFile.name} on channel ${channel}`, 'info');

    } catch (error) {
      this.error(`Broadcast failed: ${error.message}`, error);
    }
  }
}

module.exports = RadioGPIOBroadcastNode;
