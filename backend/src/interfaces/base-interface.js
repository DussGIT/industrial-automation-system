const EventEmitter = require('events');
const logger = require('../../core/logger');

/**
 * Base class for all communication interfaces
 */
class BaseInterface extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id;
    this.type = config.type;
    this.name = config.name || this.type;
    this.config = config.config || {};
    this.status = 'inactive';
    this.lastError = null;
    this.stats = {
      connected: 0,
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0
    };
  }

  /**
   * Connect to the interface
   */
  async connect() {
    throw new Error('connect() must be implemented by subclass');
  }

  /**
   * Disconnect from the interface
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by subclass');
  }

  /**
   * Read data from the interface
   * @param {Object} params - Read parameters
   */
  async read(params) {
    throw new Error('read() must be implemented by subclass');
  }

  /**
   * Write data to the interface
   * @param {Object} params - Write parameters
   */
  async write(params) {
    throw new Error('write() must be implemented by subclass');
  }

  /**
   * Get interface status
   */
  getStatus() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      status: this.status,
      lastError: this.lastError,
      stats: { ...this.stats }
    };
  }

  /**
   * Set status
   * @param {string} status 
   */
  setStatus(status) {
    this.status = status;
    this.emit('status', { status });
    this.log(`Status changed to: ${status}`);
  }

  /**
   * Handle error
   * @param {Error} error 
   */
  handleError(error) {
    this.lastError = {
      message: error.message,
      timestamp: Date.now()
    };
    this.stats.errors++;
    this.emit('error', error);
    this.error(`Interface error: ${error.message}`);
  }

  /**
   * Log message
   * @param {string} message 
   * @param {string} level 
   */
  log(message, level = 'info') {
    logger[level](`[${this.type}:${this.name}] ${message}`);
  }

  /**
   * Log error
   * @param {string} message 
   */
  error(message) {
    this.log(message, 'error');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Override in subclass if needed
    if (this.status === 'connected') {
      await this.disconnect();
    }
  }
}

module.exports = BaseInterface;
