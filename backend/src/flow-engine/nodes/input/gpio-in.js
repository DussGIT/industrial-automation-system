const BaseNode = require('../base-node');
const { getGPIOManager } = require('../../../core/gpio-manager');

/**
 * GPIO Input Node
 * Reads a GPIO pin value
 */
class GPIOInNode extends BaseNode {
  static type = 'gpio-in';
  constructor(config) {
    super(config);
    this.pin = config.pin || null;
    this.pinName = config.pinName || null;
    this.interval = config.interval || 1000;
    this.gpio = getGPIOManager();
    this.pollTimer = null;
    this.lastValue = null;
  }

  async onStart() {
    // Start polling if configured
    if (this.interval > 0) {
      this.pollTimer = setInterval(() => this.readPin(), this.interval);
    }
  }

  async onStop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async readPin() {
    try {
      // Determine which pin to use
      let pin = this.pin;
      
      if (this.pinName && this.gpio.pins[this.pinName]) {
        pin = this.gpio.pins[this.pinName];
      }
      
      if (pin === null || pin === undefined) {
        throw new Error('No GPIO pin specified');
      }

      // Read from pin
      const value = await this.gpio.readPin(pin);

      // Only send if value changed
      if (value !== this.lastValue) {
        this.lastValue = value;
        
        this.send({
          payload: value,
          pin: pin,
          pinName: this.pinName || `GPIO${pin}`,
          timestamp: Date.now()
        });

        this.updateStatus('green', 'dot', `Pin ${pin}: ${value ? 'HIGH' : 'LOW'}`);
      }
    } catch (error) {
      this.error('GPIO read failed', error);
      this.updateStatus('red', 'dot', 'Error');
    }
  }

  async onInput(msg) {
    // Manual read trigger
    await this.readPin();
  }
}

module.exports = GPIOInNode;
