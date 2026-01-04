const BaseNode = require('../base-node');
const { getGPIOManager } = require('../../../core/gpio-manager');

/**
 * AWR ERM100 Multi-Channel Broadcast Node
 * Broadcasts to multiple channels sequentially
 */
class AWRERM100BroadcastNode extends BaseNode {
  static type = 'awr-erm100-broadcast';
  
  constructor(config) {
    super(config);
    const nodeConfig = config.data?.config || config;
    
    this.channels = nodeConfig.channels || [0, 1, 2, 3];
    this.duration = nodeConfig.duration || 2000;
    this.delayBetween = nodeConfig.delayBetween || 500;
    this.preKeyDelay = nodeConfig.preKeyDelay || 100;
    this.postKeyDelay = nodeConfig.postKeyDelay || 100;
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
      const duration = msg.duration !== undefined ? msg.duration : this.duration;
      const delayBetween = msg.delayBetween !== undefined ? msg.delayBetween : this.delayBetween;

      this.broadcasting = true;
      this.log(`Multi-channel broadcast: ${channels.join(', ')}`);

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

          // Transmit
          await this.gpio.activatePTT();
          await this.sleep(duration);
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

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AWRERM100BroadcastNode;
