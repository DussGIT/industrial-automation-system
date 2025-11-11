const BaseNode = require('../base-node');

/**
 * Inject Node - Triggers flow execution with configurable payload
 * Can be triggered manually, by interval, or by schedule
 */
class InjectNode extends BaseNode {
  static type = 'inject';

  constructor(config) {
    super(config);
    this.interval = null;
    this.payload = this.config.payload !== undefined ? this.config.payload : Date.now();
    this.repeat = this.config.repeat || 0; // seconds, 0 = manual only
    this.once = this.config.once || false;
  }

  async start() {
    // Fire once on start if configured
    if (this.once) {
      setTimeout(() => this.trigger(), 100);
    }

    // Set up interval if configured
    if (this.repeat > 0) {
      this.interval = setInterval(() => {
        this.trigger();
      }, this.repeat * 1000);
      
      this.log(`Started with ${this.repeat}s interval`);
    }
  }

  async stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async receive(data) {
    // Manual trigger via incoming message
    this.trigger();
  }

  trigger() {
    const payload = this.evaluatePayload();
    this.log(`Triggered with payload: ${JSON.stringify(payload)}`);
    this.send({ payload });
  }

  evaluatePayload() {
    // Support different payload types
    switch (this.config.payloadType) {
      case 'date':
        return Date.now();
      case 'string':
        return String(this.payload);
      case 'number':
        return Number(this.payload);
      case 'boolean':
        return Boolean(this.payload);
      case 'json':
        try {
          return JSON.parse(this.payload);
        } catch (e) {
          this.error(new Error(`Invalid JSON payload: ${e.message}`));
          return null;
        }
      default:
        return this.payload;
    }
  }
}

module.exports = InjectNode;
