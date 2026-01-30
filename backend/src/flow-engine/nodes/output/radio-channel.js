const BaseNode = require('../base-node');
const { getGPIOManager } = require('../../../core/gpio-manager');

/**
 * Radio Channel Select Node
 * Sets radio channel using CS0-CS3 GPIO pins
 */
class RadioChannelNode extends BaseNode {
  static type = 'radio-channel';
  constructor(config) {
    super(config);
    
    // The config.config property contains the actual node configuration
    const nodeConfig = config.config || config;
    this.radioId = nodeConfig.radioId || 'default'; // Radio profile ID
    this.channel = nodeConfig.channel !== undefined ? parseInt(nodeConfig.channel) : 0;
    this.gpio = getGPIOManager();
  }

  async receive(msg) {
    try {
      // Always use the configured channel as the default
      let channel = this.channel;
      
      // Only allow override if msg.channel is explicitly set and is a valid channel (0-15)
      if (msg.channel !== undefined) {
        const msgChannel = parseInt(msg.channel);
        if (!isNaN(msgChannel) && msgChannel >= 0 && msgChannel <= 15) {
          channel = msgChannel;
        }
      }

      // Convert to number
      channel = parseInt(channel);

      if (isNaN(channel) || channel < 0 || channel > 15) {
        throw new Error(`Invalid channel: ${channel}. Must be 0-15`);
      }
      
      this.log(`Setting channel to ${channel} (configured: ${this.channel}, radio: ${this.radioId})`);

      // Set the channel
      const result = await this.gpio.setChannel(channel, this.radioId);
      
      if (!result) {
        throw new Error(`Failed to set channel ${channel} - GPIO write failed`);
      }

      msg.payload = {
        channel,
        timestamp: Date.now()
      };
      
      this.send(msg);
    } catch (error) {
      this.error(`Channel select failed: ${error.message}`, error);
    }
  }
}

module.exports = RadioChannelNode;
