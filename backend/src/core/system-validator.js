const { execSync } = require('child_process');
const fs = require('fs');
const logger = require('./logger');

/**
 * System Validator - Checks critical system dependencies at startup
 * Prevents runtime failures by validating hardware modules and configuration
 */
class SystemValidator {
  constructor() {
    this.validationErrors = [];
    this.validationWarnings = [];
  }

  /**
   * Run all system validations
   * @returns {object} { success: boolean, errors: [], warnings: [] }
   */
  async validateAll() {
    logger.info('Running system validations...');
    
    this.validationErrors = [];
    this.validationWarnings = [];

    await this.validateGPIOModule();
    await this.validateGPIOChip();
    await this.validateSerialDevices();

    const success = this.validationErrors.length === 0;
    
    if (success) {
      logger.info('✓ All system validations passed');
      if (this.validationWarnings.length > 0) {
        logger.warn(`Found ${this.validationWarnings.length} warning(s):`);
        this.validationWarnings.forEach(w => logger.warn(`  - ${w}`));
      }
    } else {
      logger.error('✗ System validation failed with errors:');
      this.validationErrors.forEach(e => logger.error(`  - ${e}`));
    }

    return {
      success,
      errors: this.validationErrors,
      warnings: this.validationWarnings
    };
  }

  /**
   * Validate that pinctrl-upboard kernel module is loaded
   * CRITICAL: This module is required for GPIO on UP Board
   */
  async validateGPIOModule() {
    try {
      const lsmodOutput = execSync('lsmod', { encoding: 'utf8' });
      
      if (!lsmodOutput.includes('pinctrl_upboard')) {
        this.validationErrors.push(
          'GPIO Module Missing: pinctrl-upboard kernel module is not loaded. ' +
          'GPIO will not function. Run: sudo modprobe pinctrl-upboard'
        );
        return false;
      }
      
      logger.info('✓ GPIO module (pinctrl-upboard) is loaded');
      return true;
    } catch (error) {
      this.validationWarnings.push(
        `Could not check GPIO module status: ${error.message}. ` +
        'This may be normal in non-privileged containers.'
      );
      return true; // Don't fail startup if we can't check
    }
  }

  /**
   * Validate that gpiochip5 exists and is the Raspberry Pi compatible GPIO
   * CRITICAL: After loading pinctrl-upboard, GPIO moves to gpiochip5
   */
  async validateGPIOChip() {
    try {
      // Check if gpiochip5 exists
      if (!fs.existsSync('/dev/gpiochip5')) {
        this.validationErrors.push(
          'GPIO Chip Missing: /dev/gpiochip5 does not exist. ' +
          'Ensure pinctrl-upboard module is loaded and --device=/dev/gpiochip5 is mapped in Docker.'
        );
        return false;
      }

      // Verify chip label using gpiodetect if available
      try {
        const gpiodetect = execSync('gpiodetect', { encoding: 'utf8' });
        const chip5Line = gpiodetect.split('\n').find(line => line.includes('gpiochip5'));
        
        if (chip5Line) {
          if (chip5Line.includes('Raspberry Pi compatible UP GPIO')) {
            logger.info('✓ GPIO chip validated: gpiochip5 is UP Board Pi-compatible GPIO');
            return true;
          } else {
            this.validationWarnings.push(
              `gpiochip5 exists but has unexpected label: ${chip5Line}. ` +
              'Expected "Raspberry Pi compatible UP GPIO"'
            );
          }
        }
      } catch (error) {
        // gpiodetect not available, just check device exists
        logger.info('✓ GPIO chip exists: /dev/gpiochip5 (gpiodetect not available for verification)');
      }

      return true;
    } catch (error) {
      this.validationErrors.push(`GPIO chip validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate serial devices for XBee and other interfaces
   */
  async validateSerialDevices() {
    try {
      const devices = fs.readdirSync('/dev').filter(f => f.startsWith('ttyUSB'));
      
      if (devices.length === 0) {
        this.validationWarnings.push(
          'No USB serial devices found. XBee and other serial interfaces may not be available.'
        );
        return true; // Warning only, not fatal
      }

      logger.info(`✓ Found ${devices.length} USB serial device(s): ${devices.join(', ')}`);
      return true;
    } catch (error) {
      this.validationWarnings.push(`Could not check serial devices: ${error.message}`);
      return true; // Don't fail startup
    }
  }

  /**
   * Get validation summary for logging/display
   */
  getSummary() {
    return {
      totalErrors: this.validationErrors.length,
      totalWarnings: this.validationWarnings.length,
      errors: this.validationErrors,
      warnings: this.validationWarnings
    };
  }
}

// Singleton instance
let validatorInstance = null;

function getSystemValidator() {
  if (!validatorInstance) {
    validatorInstance = new SystemValidator();
  }
  return validatorInstance;
}

module.exports = { getSystemValidator, SystemValidator };
