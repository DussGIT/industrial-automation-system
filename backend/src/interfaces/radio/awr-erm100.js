const BaseInterface = require('../base-interface');
const { getGPIOManager } = require('../../core/gpio-manager');

/**
 * AWR ERM100 Radio Interface
 * GPIO-based control for AWR ERM100 radio via UP Board
 * 
 * Uses gpiochip4 (UP Board CPLD/FPGA) to control:
 * - PTT (Push To Talk) - Physical Pin 13
 * - Channel Selection (CS0-CS3) - Binary channel encoding (0-15)
 * - Clear Channel detection - Physical Pin 32
 */
class AWRERM100Interface extends BaseInterface {
  static type = 'radio-awr-erm100';

  constructor(config) {
    super(config);
    this.gpio = getGPIOManager();
    this.currentChannel = this.config.channel || 0;
    this.pttActive = false;
    this.clearChannelEnabled = this.config.clearChannelEnabled || false;
    
    // Timing configurations (milliseconds)
    this.timings = {
      preKeyDelay: this.config.preKeyDelay || 100,      // Delay before PTT activation
      postKeyDelay: this.config.postKeyDelay || 100,    // Delay after PTT deactivation
      channelSwitchDelay: this.config.channelSwitchDelay || 50, // Delay after channel switch
      pttMinDuration: this.config.pttMinDuration || 100, // Minimum PTT duration
      pttMaxDuration: this.config.pttMaxDuration || 30000 // Maximum PTT duration (30s safety)
    };
  }

  async connect() {
    try {
      this.log('Initializing AWR ERM100 radio interface');
      
      // Initialize GPIO system if not already initialized
      if (!this.gpio.chip) {
        await this.gpio.initialize();
      }
      
      // Set initial state - PTT off, set configured channel
      await this.gpio.deactivatePTT();
      await this.gpio.setChannel(this.currentChannel);
      
      if (this.clearChannelEnabled) {
        await this.gpio.activateClearChannel();
        this.log('Clear channel detection enabled');
      } else {
        await this.gpio.deactivateClearChannel();
      }
      
      this.setStatus('connected');
      this.stats.connected = Date.now();
      this.log(`AWR ERM100 initialized on channel ${this.currentChannel}`);
      
      return true;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async disconnect() {
    try {
      // Ensure PTT is off
      if (this.pttActive) {
        await this.setPTT(false);
      }
      
      // Turn off clear channel
      await this.gpio.deactivateClearChannel();
      
      this.setStatus('disconnected');
      this.log('AWR ERM100 disconnected');
      
      return true;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Set radio channel (0-15)
   * @param {number} channel - Channel number 0-15
   */
  async setChannel(channel) {
    if (channel < 0 || channel > 15) {
      throw new Error('Channel must be between 0 and 15');
    }

    try {
      this.log(`Switching to channel ${channel}`);
      
      // Don't switch channel while transmitting
      if (this.pttActive) {
        this.log('Cannot change channel while PTT is active');
        throw new Error('Cannot change channel during transmission');
      }
      
      await this.gpio.setChannel(channel);
      this.currentChannel = channel;
      
      // Wait for radio to settle on new channel
      await this.sleep(this.timings.channelSwitchDelay);
      
      this.log(`Channel set to ${channel}`);
      this.emit('channel-changed', { channel });
      
      return true;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Activate/deactivate PTT
   * @param {boolean} active - true to transmit, false to receive
   */
  async setPTT(active) {
    try {
      if (active === this.pttActive) {
        this.log(`PTT already ${active ? 'active' : 'inactive'}`);
        return true;
      }

      if (active) {
        this.log('Activating PTT');
        
        // Pre-key delay (allows audio system to prepare)
        if (this.timings.preKeyDelay > 0) {
          await this.sleep(this.timings.preKeyDelay);
        }
        
        await this.gpio.activatePTT();
        this.pttActive = true;
        this.stats.transmissions = (this.stats.transmissions || 0) + 1;
        this.stats.lastTransmission = Date.now();
        
        this.emit('ptt-activated', { channel: this.currentChannel });
        this.log('PTT activated');
        
      } else {
        this.log('Deactivating PTT');
        
        await this.gpio.deactivatePTT();
        this.pttActive = false;
        
        // Post-key delay (allows radio to return to receive)
        if (this.timings.postKeyDelay > 0) {
          await this.sleep(this.timings.postKeyDelay);
        }
        
        this.emit('ptt-deactivated', { channel: this.currentChannel });
        this.log('PTT deactivated');
      }
      
      return true;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Pulse PTT for a specific duration
   * @param {number} duration - Duration in milliseconds
   */
  async pulsePTT(duration) {
    // Enforce minimum and maximum duration
    const safeDuration = Math.max(
      this.timings.pttMinDuration,
      Math.min(duration, this.timings.pttMaxDuration)
    );
    
    if (safeDuration !== duration) {
      this.log(`PTT duration adjusted from ${duration}ms to ${safeDuration}ms for safety`);
    }
    
    try {
      this.log(`PTT pulse: ${safeDuration}ms on channel ${this.currentChannel}`);
      
      await this.setPTT(true);
      await this.sleep(safeDuration);
      await this.setPTT(false);
      
      this.emit('ptt-pulsed', { 
        channel: this.currentChannel, 
        duration: safeDuration 
      });
      
      return true;
    } catch (error) {
      // Ensure PTT is off even if error occurs
      try {
        await this.setPTT(false);
      } catch (deactivateError) {
        this.log('Failed to deactivate PTT after error');
      }
      throw error;
    }
  }

  /**
   * Check if channel is clear
   * @returns {boolean} true if channel is clear
   */
  async checkClearChannel() {
    try {
      // Read clear channel pin state
      const clearChannelPin = this.gpio.pins.CLEAR_CHANNEL;
      const value = await this.gpio.readPin(clearChannelPin);
      
      // Assuming: HIGH (1) = clear, LOW (0) = busy
      const isClear = value === 1;
      
      this.log(`Clear channel check: ${isClear ? 'CLEAR' : 'BUSY'}`);
      return isClear;
    } catch (error) {
      this.handleError(error);
      // If we can't read clear channel, assume it's NOT clear for safety
      return false;
    }
  }

  /**
   * Wait for clear channel with timeout
   * @param {number} timeout - Maximum wait time in milliseconds
   * @param {number} checkInterval - How often to check (milliseconds)
   * @returns {boolean} true if channel became clear
   */
  async waitForClearChannel(timeout = 5000, checkInterval = 100) {
    const startTime = Date.now();
    
    this.log(`Waiting for clear channel (timeout: ${timeout}ms)`);
    
    while (Date.now() - startTime < timeout) {
      if (await this.checkClearChannel()) {
        this.log('Channel is clear');
        return true;
      }
      await this.sleep(checkInterval);
    }
    
    this.log('Clear channel timeout');
    return false;
  }

  /**
   * Transmit with automatic clear channel check
   * @param {number} duration - PTT duration in milliseconds
   * @param {object} options - Transmission options
   */
  async transmit(duration, options = {}) {
    const {
      checkClear = true,
      clearTimeout = 5000,
      forceTransmit = false,
      channel = null
    } = options;

    try {
      // Switch channel if requested
      if (channel !== null && channel !== this.currentChannel) {
        await this.setChannel(channel);
      }

      // Check for clear channel if enabled
      if (checkClear && !forceTransmit) {
        const isClear = await this.waitForClearChannel(clearTimeout);
        
        if (!isClear) {
          this.log('Channel busy - transmission aborted');
          this.emit('transmission-blocked', { 
            channel: this.currentChannel,
            reason: 'channel-busy'
          });
          return false;
        }
      }

      // Transmit
      await this.pulsePTT(duration);
      
      this.emit('transmission-complete', {
        channel: this.currentChannel,
        duration
      });
      
      return true;
    } catch (error) {
      this.handleError(error);
      this.emit('transmission-failed', {
        channel: this.currentChannel,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Broadcast to multiple channels sequentially
   * @param {Array<number>} channels - Array of channel numbers
   * @param {number} duration - PTT duration per channel
   * @param {number} delayBetween - Delay between channels
   */
  async broadcastMultiChannel(channels, duration, delayBetween = 500) {
    const results = [];
    
    this.log(`Multi-channel broadcast: channels ${channels.join(', ')}`);
    
    for (const channel of channels) {
      try {
        await this.setChannel(channel);
        await this.pulsePTT(duration);
        
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
    
    this.emit('multi-channel-broadcast-complete', { results });
    return results;
  }

  /**
   * Get current radio status
   */
  getStatus() {
    return {
      ...super.getStatus(),
      channel: this.currentChannel,
      pttActive: this.pttActive,
      clearChannelEnabled: this.clearChannelEnabled,
      timings: this.timings
    };
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AWRERM100Interface;
