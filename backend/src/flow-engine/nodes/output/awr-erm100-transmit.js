const BaseNode = require('../base-node');
const { getGPIOManager } = require('../../../core/gpio-manager');

/**
 * AWR ERM100 Transmit Node
 * Transmits on the AWR ERM100 radio with channel selection and timing control
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
    this.gpio = getGPIOManager();
    
    this.transmitting = false;
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
      const duration = msg.duration !== undefined ? msg.duration : this.duration;

      this.log(`Transmitting on channel ${channel} for ${duration}ms`);

      // Set channel
      await this.gpio.setChannel(channel);
      await this.sleep(50);

      // Pre-key delay
      if (this.preKeyDelay > 0) {
        await this.sleep(this.preKeyDelay);
      }

      // Transmit
      this.transmitting = true;
      
      await this.gpio.activatePTT();
      await this.sleep(duration);
      await this.gpio.deactivatePTT();

      this.transmitting = false;

      // Post-key delay
      if (this.postKeyDelay > 0) {
        await this.sleep(this.postKeyDelay);
      }

      msg.payload = {
        success: true,
        channel,
        duration,
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

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AWRERM100TransmitNode;
