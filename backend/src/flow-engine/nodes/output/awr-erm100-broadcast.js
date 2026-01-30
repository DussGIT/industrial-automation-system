const BaseNode = require('../base-node');
const { getGPIOManager } = require('../../../core/gpio-manager');
const { getDb } = require('../../../core/database');
const { exec } = require('child_process');
const fs = require('fs');

/**
 * AWR ERM100 Multi-Channel Broadcast Node
 * Broadcasts to multiple channels sequentially
 */
class AWRERM100BroadcastNode extends BaseNode {
  static type = 'awr-erm100-broadcast';
  
  constructor(config) {
    super(config);
    this.channels = this.config.channels || [0, 1, 2, 3];
    this.duration = this.config.duration || 2000;
    this.delayBetween = this.config.delayBetween !== undefined ? this.config.delayBetween : 500;
    this.preKeyDelay = this.config.preKeyDelay || 100;
    this.postKeyDelay = this.config.postKeyDelay || 100;
    this.audioFileId = this.config.audioFileId || null;
    this.gpio = getGPIOManager();
    
    this.broadcasting = false;
  }

  async start() {
    // Node ready
  }

  async stop() {
    if (this.broadcasting) {
      await this.gpio.deactivatePTT();
      this.broadcasting = false;
    }
  }

  async receive(msg) {
    try {
      if (this.broadcasting) {
        this.log('Already broadcasting, message ignored', 'warn');
        return;
      }

      // Extract parameters from message or use node config
      const channels = msg.channels || this.channels;
      const audioFileId = msg.audioFileId || this.audioFileId;
      const delayBetween = msg.delayBetween !== undefined ? msg.delayBetween : this.delayBetween;

      // DEBUG: Log what we received
      this.log(`Broadcast config - audioFileId from msg: ${msg.audioFileId}, from config: ${this.audioFileId}, final: ${audioFileId}`, 'info');

      let audioFilePath = null;
      let actualDuration = this.duration;

      // Get audio file if specified
      if (audioFileId) {
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
        this.log(`Broadcasting audio: ${audioFile.name} (${actualDuration}ms) to channels: ${channels.join(', ')}`, 'info');
      } else {
        // Manual mode with duration override if provided
        actualDuration = msg.duration !== undefined ? msg.duration : this.duration;
        this.log(`Multi-channel broadcast (${actualDuration}ms): ${channels.join(', ')}`);
      }

      this.broadcasting = true;

      const results = [];

      // Broadcast to each channel
      for (const channel of channels) {
        try {
          // Set channel
          await this.gpio.setChannel(channel);
          await this.sleep(50);

          // Pre-key delay
          if (this.preKeyDelay > 0) {
            await this.sleep(this.preKeyDelay);
          }

          // Activate PTT and transmit
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

          // Post-key delay
          if (this.postKeyDelay > 0) {
            await this.sleep(this.postKeyDelay);
          }

          results.push({ channel, success: true });

          // Delay between channels
          if (delayBetween > 0) {
            await this.sleep(delayBetween);
          }

        } catch (error) {
          this.log(`Failed to broadcast on channel ${channel}: ${error.message}`);
          results.push({ channel, success: false, error: error.message });
        }
      }

      this.broadcasting = false;

      // Send results
      msg.payload = {
        success: true,
        channels,
        results,
        totalChannels: channels.length,
        successCount: results.filter(r => r.success).length,
        failedCount: results.filter(r => !r.success).length,
        timestamp: Date.now()
      };
      
      this.send(msg);

    } catch (error) {
      this.broadcasting = false;
      // Ensure PTT is released on error
      try {
        await this.gpio.deactivatePTT();
      } catch (pttError) {
        this.log(`Failed to deactivate PTT: ${pttError.message}`, 'error');
      }
      this.error(error);
      this.log(`Broadcast failed: ${error.message}`, 'error');
    }
  }

  /**
   * Play audio file
   * @param {string} filepath - Path to audio file
   * @returns {Promise<void>}
   */
  async playAudio(filepath) {
    return new Promise((resolve, reject) => {
      // Use aplay on Linux (UP Board) with HDMI device and fallbacks
      const command = `aplay -D plughw:0,3 "${filepath}" 2>/dev/null || aplay "${filepath}" || paplay "${filepath}" || ffplay -nodisp -autoexit "${filepath}"`;
      
      this.log(`Executing audio playback: ${command}`, 'debug');
      
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

module.exports = AWRERM100BroadcastNode;
