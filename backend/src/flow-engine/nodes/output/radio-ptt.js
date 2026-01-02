const BaseNode = require('../base-node');
const { getGPIOManager } = require('../../../core/gpio-manager');

/**
 * Radio PTT (Push To Talk) Node
 * Controls PTT via GPIO
 */
class RadioPTTNode extends BaseNode {
  static type = 'radio-ptt';
  constructor(config) {
    super(config);
    this.action = config.action || 'toggle'; // 'on', 'off', 'toggle', 'pulse'
    this.duration = config.duration || 1000; // For pulse mode
    this.gpio = getGPIOManager();
    this.pttActive = false;
  }

  async receive(msg) {
    try {
      const action = msg.action || this.action;
      const duration = msg.duration || this.duration;

      switch (action) {
        case 'on':
        case 'activate':
        case true:
        case 1:
          await this.gpio.activatePTT();
          this.pttActive = true;
          this.updateStatus('green', 'dot', 'PTT Active');
          break;

        case 'off':
        case 'deactivate':
        case false:
        case 0:
          await this.gpio.deactivatePTT();
          this.pttActive = false;
          this.updateStatus('grey', 'dot', 'PTT Inactive');
          break;

        case 'toggle':
          if (this.pttActive) {
            await this.gpio.deactivatePTT();
            this.pttActive = false;
            this.updateStatus('grey', 'dot', 'PTT Inactive');
          } else {
            await this.gpio.activatePTT();
            this.pttActive = true;
            this.updateStatus('green', 'dot', 'PTT Active');
          }
          break;

        case 'pulse':
          await this.gpio.activatePTT();
          this.pttActive = true;
          this.updateStatus('green', 'dot', `PTT Active (${duration}ms)`);
          
          setTimeout(async () => {
            await this.gpio.deactivatePTT();
            this.pttActive = false;
            this.updateStatus('grey', 'dot', 'PTT Inactive');
          }, duration);
          break;

        default:
          throw new Error(`Unknown PTT action: ${action}`);
      }

      msg.payload = {
        action,
        active: this.pttActive,
        timestamp: Date.now()
      };
      
      this.send(msg);
    } catch (error) {
      this.error('PTT control failed', error);
      this.updateStatus('red', 'dot', 'Error');
    }
  }

  async onStop() {
    // Ensure PTT is released when node stops
    if (this.pttActive) {
      await this.gpio.deactivatePTT();
      this.pttActive = false;
    }
  }
}

module.exports = RadioPTTNode;
