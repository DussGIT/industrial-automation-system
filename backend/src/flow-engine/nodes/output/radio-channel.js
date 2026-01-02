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
    this.channel = config.channel || 0;
    this.gpio = getGPIOManager();
  }

  async receive(msg) {
    try {
      // Get channel from message or config
      let channel = msg.channel !== undefined ? msg.channel : msg.payload;
      
      if (channel === undefined || channel === null) {
        channel = this.channel;
      }

      // Convert to number
      channel = parseInt(channel);

      if (isNaN(channel) || channel < 0 || channel > 15) {
        throw new Error(`Invalid channel: ${channel}. Must be 0-15`);
      }

      // Set the channel
      await this.gpio.setChannel(channel);

      msg.payload = {
        channel,
        timestamp: Date.now()
      };
      
      this.send(msg);
      this.updateStatus('green', 'dot', `Channel ${channel}`);
    } catch (error) {
      this.error('Channel select failed', error);
      this.updateStatus('red', 'dot', 'Error');
    }
  }
}

module.exports = RadioChannelNode;
