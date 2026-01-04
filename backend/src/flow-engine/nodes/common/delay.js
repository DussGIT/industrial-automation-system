const BaseNode = require('../base-node');
const logger = require('../../../core/logger');

class DelayNode extends BaseNode {
  constructor(config) {
    super(config);
    const actualConfig = config.data?.config || config;
    this.delayMs = actualConfig.delayMs || 1000; // Default 1 second
    this.delayUnit = actualConfig.delayUnit || 'milliseconds'; // milliseconds, seconds, minutes
    this.rateLimited = actualConfig.rateLimited || false; // Drop messages if one is queued
    this.pendingTimeout = null;
  }

  async start() {
    logger.info('Delay node started', {
      service: 'flow-engine',
      nodeId: this.id,
      delay: this.getDelayMs() + 'ms',
      rateLimited: this.rateLimited
    });
  }

  getDelayMs() {
    switch (this.delayUnit) {
      case 'seconds':
        return this.delayMs * 1000;
      case 'minutes':
        return this.delayMs * 60 * 1000;
      case 'milliseconds':
      default:
        return this.delayMs;
    }
  }

  async receive(data, sourcePort, targetPort) {
    try {
      // If rate limited and a message is already pending, drop this one
      if (this.rateLimited && this.pendingTimeout) {
        logger.debug('Delay node dropping message (rate limited)', {
          service: 'flow-engine',
          nodeId: this.id
        });
        return;
      }

      const delayMs = this.getDelayMs();

      logger.debug('Delay node queuing message', {
        service: 'flow-engine',
        nodeId: this.id,
        delayMs
      });

      // Set up the delayed send
      this.pendingTimeout = setTimeout(() => {
        this.send(data);
        this.pendingTimeout = null;
        
        logger.debug('Delay node sent message', {
          service: 'flow-engine',
          nodeId: this.id
        });
      }, delayMs);

    } catch (error) {
      logger.error(`Delay node error: ${error.message}`, {
        service: 'flow-engine',
        nodeId: this.id,
        error: error.message
      });
    }
  }

  async stop() {
    // Clear any pending timeout
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }

    logger.info('Delay node stopped', {
      service: 'flow-engine',
      nodeId: this.id
    });
  }

  async cleanup() {
    await this.stop();
  }
}

DelayNode.type = 'delay';

module.exports = DelayNode;
