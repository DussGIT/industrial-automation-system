const BaseNode = require('../base-node');
const { getGPIOManager } = require('../../../core/gpio-manager');

/**
 * AWR ERM100 Set Channel Node
 * Changes the radio channel on AWR ERM100
 */
class AWRERM100ChannelNode extends BaseNode {
  static type = 'awr-erm100-channel';
  
  constructor(config) {
    super(config);
    const nodeConfig = config.data?.config || config;
    
    this.channel = nodeConfig.channel !== undefined ? nodeConfig.channel : 0;
    this.gpio = getGPIOManager();
  }

  async receive(msg) {
    try {
      // Get channel from message or node config
      let channel = this.channel;
      
      if (msg.channel !== undefined) {
        channel = msg.channel;
      } else if (msg.payload !== undefined && typeof msg.payload === 'number') {
        channel = msg.payload;
      }

      // Validate channel
      if (channel < 0 || channel > 15) {
        throw new Error(`Invalid channel ${channel}. Must be 0-15`);
      }

      // Set channel using GPIO
      await this.gpio.setChannel(channel);
      
      this.log(`Channel set to ${channel}`, 'info');

      // Pass message through with channel info
      msg.channel = channel;
      msg.payload = { channel, timestamp: Date.now() };
      this.send(msg);

    } catch (error) {
      this.error(error);
      this.log(`Channel set failed: ${error.message}`, 'error');
    }
  }
}

module.exports = AWRERM100ChannelNode;
