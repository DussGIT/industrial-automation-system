const { Chip } = require('node-libgpiod');
const logger = require('../core/logger');

/**
 * GPIO Manager for UP Board using libgpiod (modern GPIO interface)
 * Physical pin to gpiochip/line mapping based on UP Board specification
 */
class GPIOManager {
  constructor() {
    // UP Board HAT connector pin mapping using gpiochip0
    // Based on GPIO_STATUS.md verified mappings
    this.pinMap = {
      // Radio Control Pins (from GPIO_STATUS.md)
      13: { chip: 0, line: 17 },  // PTT - Push To Talk (Physical Pin 13 = gpiochip0 line 17)
      15: { chip: 0, line: 6 },   // CS3 - Channel Select 3 (Physical Pin 15 = gpiochip0 line 6)
      16: { chip: 0, line: 19 },  // CS2 - Channel Select 2 (Physical Pin 16 = gpiochip0 line 19)
      18: { chip: 0, line: 20 },  // CS1 - Channel Select 1 (Physical Pin 18 = gpiochip0 line 20)
      22: { chip: 0, line: 21 },  // CS0 - Channel Select 0 (Physical Pin 22 = gpiochip0 line 21)
      32: { chip: 0, line: 25 },  // CLEAR CHANNEL (Physical Pin 32 = gpiochip0 line 25)
      
      // Additional GPIO pins (need to verify these if used)
      12: { chip: 0, line: 18 },  // GPIO 18 (Physical Pin 12)
      19: { chip: 0, line: 10 },  // GPIO 10 (Physical Pin 19)
      21: { chip: 0, line: 9 },   // GPIO 9 (Physical Pin 21)
      33: { chip: 0, line: 13 },  // GPIO 13 (Physical Pin 33)
    };

    // Named pins for radio control
    this.pins = {
      PTT: 13,          // Physical Pin 13
      CS0: 22,          // Physical Pin 22
      CS1: 18,          // Physical Pin 18
      CS2: 16,          // Physical Pin 16
      CS3: 15,          // Physical Pin 15
      CLEAR_CHANNEL: 32, // Physical Pin 32
      GPIO1: 12,        // Physical Pin 12
      GPIO7: 19,        // Physical Pin 19
      GPIO8: 21,        // Physical Pin 21
      GPIO13: 33,       // Physical Pin 33
    };

    this.chipNumber = 0; // gpiochip0 - Main GPIO controller for UP Board
    this.chip = null;
    this.lines = new Map();
    this.pinStates = new Map();
  }

  /**
   * Initialize GPIO system
   */
  async initialize() {
    try {
      logger.info('Initializing GPIO Manager with libgpiod...');
      logger.info(`Using gpiochip${this.chipNumber} - UP Board Main GPIO Controller`);
      
      // Open GPIO chip 0 (Main GPIO controller)
      this.chip = new Chip(this.chipNumber);
      
      logger.info('GPIO chip opened successfully');
      logger.info('Physical Pin Mapping:', this.pins);
      
      return true;
    } catch (error) {
      logger.error('GPIO initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Get or create GPIO line for a physical pin
   * @param {number} physicalPin - Physical pin number
   * @param {string} direction - 'in' or 'out'
   * @returns {object} GPIO line
   */
  getLine(physicalPin, direction = 'out') {
    const key = `${physicalPin}_${direction}`;
    
    if (this.lines.has(key)) {
      return this.lines.get(key);
    }

    const mapping = this.pinMap[physicalPin];
    if (!mapping) {
      throw new Error(`Physical pin ${physicalPin} not mapped`);
    }

    try {
      const line = this.chip.getLine(mapping.line);
      
      if (direction === 'out') {
        line.requestOutputMode();
      } else {
        line.requestInputMode();
      }
      
      this.lines.set(key, line);
      logger.debug(`GPIO line created for physical pin ${physicalPin} (chip${mapping.chip} line ${mapping.line})`);
      return line;
    } catch (error) {
      logger.error(`Failed to create GPIO line for pin ${physicalPin}:`, error.message);
      throw error;
    }
  }

  /**
   * Write value to GPIO pin
   * @param {number} physicalPin - Physical pin number
   * @param {number|boolean} value - 0/1 or false/true
   */
  async writePin(physicalPin, value) {
    try {
      logger.info(`GPIO WRITE CALLED: pin=${physicalPin}, value=${value}`);
      const val = value ? 1 : 0;
      const key = `${physicalPin}_out`;
      const mapping = this.pinMap[physicalPin];
      
      if (!mapping) {
        throw new Error(`Physical pin ${physicalPin} not mapped`);
      }
      
      logger.info(`GPIO mapping found: chip${mapping.chip} line ${mapping.line}`);
      
      // Get or create line and keep it open
      if (!this.lines.has(key)) {
        logger.info(`Opening GPIO line for pin ${physicalPin}...`);
        const line = this.chip.getLine(mapping.line);
        line.requestOutputMode('gpio-manager'); // Request without initial value
        this.lines.set(key, line);
        logger.info(`GPIO line opened for pin ${physicalPin} (chip${mapping.chip} line ${mapping.line})`);
      }
      
      const line = this.lines.get(key);
      logger.info(`Setting GPIO line to ${val}...`);
      line.setValue(val);
      
      this.pinStates.set(physicalPin, val);
      logger.info(`GPIO pin ${physicalPin} (chip${mapping.chip} line ${mapping.line}) set to ${val}`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to write to GPIO pin ${physicalPin}:`, error.message);
      return false;
    }
  }

  /**
   * Read value from GPIO pin
   * @param {number} physicalPin - Physical pin number
   * @returns {Promise<number>} 0 or 1
   */
  async readPin(physicalPin) {
    try {
      const line = this.getLine(physicalPin, 'in');
      const value = line.getValue();
      
      this.pinStates.set(physicalPin, value);
      return value;
    } catch (error) {
      logger.error(`Failed to read GPIO pin ${physicalPin}:`, error.message);
      return 0;
    }
  }

  /**
   * Activate PTT (Push To Talk)
   */
  async activatePTT() {
    logger.info('Activating PTT');
    return await this.writePin(this.pins.PTT, 1);
  }

  /**
   * Deactivate PTT (Push To Talk)
   */
  async deactivatePTT() {
    logger.info('Deactivating PTT');
    return await this.writePin(this.pins.PTT, 0);
  }

  /**
   * Set radio channel (0-15)
   * @param {number} channel - Channel number (0-15)
   */
  async setChannel(channel) {
    if (channel < 0 || channel > 15) {
      logger.error(`Invalid channel ${channel}. Must be 0-15`);
      return false;
    }

    logger.info(`Setting radio channel to ${channel}`);

    // Calculate pin values for binary encoding
    const cs0 = (channel & 0x01) !== 0 ? 1 : 0;
    const cs1 = (channel & 0x02) !== 0 ? 1 : 0;
    const cs2 = (channel & 0x04) !== 0 ? 1 : 0;
    const cs3 = (channel & 0x08) !== 0 ? 1 : 0;

    logger.info(`Channel ${channel} binary: CS3=${cs3} CS2=${cs2} CS1=${cs1} CS0=${cs0}`);
    logger.info(`Physical pins: CS0=${this.pins.CS0}, CS1=${this.pins.CS1}, CS2=${this.pins.CS2}, CS3=${this.pins.CS3}`);

    // Set channel select pins (binary encoding) with small delay between each
    logger.info(`Setting CS0 (pin ${this.pins.CS0}) to ${cs0}`);
    const result0 = await this.writePin(this.pins.CS0, cs0);
    logger.info(`CS0 result: ${result0}`);
    await this.sleep(10); // Small delay
    
    logger.info(`Setting CS1 (pin ${this.pins.CS1}) to ${cs1}`);
    const result1 = await this.writePin(this.pins.CS1, cs1);
    logger.info(`CS1 result: ${result1}`);
    await this.sleep(10);
    
    logger.info(`Setting CS2 (pin ${this.pins.CS2}) to ${cs2}`);
    const result2 = await this.writePin(this.pins.CS2, cs2);
    logger.info(`CS2 result: ${result2}`);
    await this.sleep(10);
    
    logger.info(`Setting CS3 (pin ${this.pins.CS3}) to ${cs3}`);
    const result3 = await this.writePin(this.pins.CS3, cs3);
    logger.info(`CS3 result: ${result3}`);

    if (!result0 || !result1 || !result2 || !result3) {
      logger.error(`Failed to set one or more channel select pins for channel ${channel}`);
      logger.error(`Results: CS0=${result0}, CS1=${result1}, CS2=${result2}, CS3=${result3}`);
      return false;
    }

    // Verify pin states
    const states = this.getPinStates();
    logger.info(`Verification - Pin states after setting channel ${channel}:`);
    logger.info(`  CS0 (pin ${this.pins.CS0}): expected=${cs0}, actual=${states[this.pins.CS0]}`);
    logger.info(`  CS1 (pin ${this.pins.CS1}): expected=${cs1}, actual=${states[this.pins.CS1]}`);
    logger.info(`  CS2 (pin ${this.pins.CS2}): expected=${cs2}, actual=${states[this.pins.CS2]}`);
    logger.info(`  CS3 (pin ${this.pins.CS3}): expected=${cs3}, actual=${states[this.pins.CS3]}`);

    logger.info(`Channel ${channel} set successfully`);
    return true;
  }

  /**
   * Enable/disable clear channel mode
   * @param {boolean} enabled - True to enable, false to disable
   */
  async setClearChannel(enabled) {
    logger.info(`${enabled ? 'Enabling' : 'Disabling'} clear channel mode`);
    return await this.writePin(this.pins.CLEAR_CHANNEL, enabled ? 1 : 0);
  }

  /**
   * Activate Clear Channel
   */
  async activateClearChannel() {
    logger.info('Activating Clear Channel');
    return await this.writePin(this.pins.CLEAR_CHANNEL, 1);
  }

  /**
   * Deactivate Clear Channel
   */
  async deactivateClearChannel() {
    logger.info('Deactivating Clear Channel');
    return await this.writePin(this.pins.CLEAR_CHANNEL, 0);
  }

  /**
   * Get current pin states
   * @returns {Object} Map of pin numbers to states
   */
  getPinStates() {
    const states = {};
    for (const [pin, value] of this.pinStates.entries()) {
      states[pin] = value;
    }
    return states;
  }

  /**
   * Sleep helper for delays
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup - release all GPIO lines
   */
  async cleanup() {
    logger.info('Cleaning up GPIO resources...');
    
    for (const [key, line] of this.lines.entries()) {
      try {
        line.release();
        logger.debug(`Released GPIO line: ${key}`);
      } catch (error) {
        logger.error(`Failed to release GPIO line ${key}:`, error.message);
      }
    }
    
    this.lines.clear();
    this.pinStates.clear();
    
    if (this.chip) {
      this.chip.close();
      this.chip = null;
    }
  }
}

const gpioManagerInstance = new GPIOManager();

module.exports = gpioManagerInstance;
module.exports.getGPIOManager = () => gpioManagerInstance;

