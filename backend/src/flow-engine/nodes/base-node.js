const EventEmitter = require('events');

/**
 * Base class for all flow nodes
 * All custom nodes should extend this class
 */
class BaseNode extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id;
    this.type = config.type;
    this.name = config.name || this.type;
    this.config = config.config || {};
    this.mqttClient = null;
    this.io = null;
  }

  /**
   * Initialize the node with required services
   * @param {MQTTClient} mqttClient 
   * @param {SocketIO} io 
   */
  async initialize(mqttClient, io) {
    this.mqttClient = mqttClient;
    this.io = io;
  }

  /**
   * Start the node (called when flow starts)
   */
  async start() {
    // Override in subclass if needed
  }

  /**
   * Stop the node (called when flow stops)
   */
  async stop() {
    // Override in subclass if needed
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Override in subclass if needed
  }

  /**
   * Receive input from connected nodes
   * @param {*} data 
   * @param {string} sourcePort 
   * @param {string} targetPort 
   */
  async receive(data, sourcePort = 'default', targetPort = 'default') {
    // Override in subclass
    throw new Error('receive() method not implemented');
  }

  /**
   * Send output to connected nodes
   * @param {*} data 
   * @param {*} input 
   */
  send(data, input = null) {
    this.emit('output', {
      input,
      output: data
    });
  }

  /**
   * Report an error
   * @param {Error} error 
   */
  error(error) {
    this.emit('error', error);
  }

  /**
   * Log a message
   * @param {string} message 
   * @param {string} level 
   */
  log(message, level = 'info') {
    const logger = require('../../core/logger');
    logger[level](`[${this.type}:${this.name}] ${message}`);
  }
}

module.exports = BaseNode;
