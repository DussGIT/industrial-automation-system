const BaseNode = require('../base-node');
const { getGPIOManager } = require('../../../core/gpio-manager');

/**
 * GPIO Output Node
 * Sets a GPIO pin to high or low
 */
class GPIOOutNode extends BaseNode {
  static type = 'gpio-out';
  constructor(config) {
    super(config);
    // Config can be nested under config.config or directly provided
    const nodeConfig = config.config || config;
    this.pin = nodeConfig.pin || null;
    this.pinName = nodeConfig.pinName || null;
    this.value = nodeConfig.value !== undefined ? nodeConfig.value : null;
    this.gpio = getGPIOManager();
  }

  async receive(msg) {
    try {
      // Determine which pin to use
      let pin = this.pin;
      
      if (this.pinName && this.gpio.pins[this.pinName]) {
        pin = this.gpio.pins[this.pinName];
      }
      
      if (pin === null || pin === undefined) {
        throw new Error('No GPIO pin specified');
      }

      // Determine value to write
      let value = this.value;
      if (value === null || value === undefined) {
        value = msg.payload;
      }

      // Convert to boolean
      const boolValue = Boolean(value);

      // Write to pin
      await this.gpio.writePin(pin, boolValue);
      
      this.log(`GPIO pin ${pin} set to ${boolValue ? 'HIGH' : 'LOW'}`, 'info');

      // Pass message through
      msg.payload = boolValue;
      this.send(msg);

    } catch (error) {
      this.error(error);
      this.log(`GPIO write failed: ${error.message}`, 'error');
    }
  }
  
  // Alias for compatibility
  async onInput(msg) {
    return this.receive(msg);
  }
}

module.exports = GPIOOutNode;
