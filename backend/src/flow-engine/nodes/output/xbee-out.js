const BaseNode = require('../base-node');
const { getXBeeManager } = require('../../../core/xbee-manager');
const logger = require('../../../core/logger');

class XBeeOutNode extends BaseNode {
  constructor(config) {
    super(config);
    this.deviceAddress = config.deviceAddress || null;
  }

  async start() {
    logger.info('XBee Out node started', {
      service: 'flow-engine',
      nodeId: this.id
    });
  }

  async receive(data, sourcePort, targetPort) {
    try {
      const xbeeManager = getXBeeManager();

      if (!xbeeManager.isReady()) {
        const error = 'XBee not connected';
        logger.warn(error, {
          service: 'flow-engine',
          nodeId: this.id
        });
        
        // Send error output instead of throwing
        this.send({
          ...data,
          error,
          success: false
        }, data);
        return;
      }

      // Get device address from message or node config
      const address = data.address || this.deviceAddress;

      if (!address) {
        const error = 'No device address specified';
        logger.warn(error, {
          service: 'flow-engine',
          nodeId: this.id
        });
        
        this.send({
          ...data,
          error,
          success: false
        }, data);
        return;
      }

      // Get data to send from message payload
      const payload = data.payload;

      if (!payload) {
        const error = 'No payload to send';
        logger.warn(error, {
          service: 'flow-engine',
          nodeId: this.id
        });
        
        this.send({
          ...data,
          error,
          success: false
        }, data);
        return;
      }

      // Send data to XBee device
      const frameId = await xbeeManager.sendData(address, payload);

      logger.info('XBee Out node sent data', {
        service: 'flow-engine',
        nodeId: this.id,
        to: address,
        frameId,
        data: typeof payload === 'string' ? payload : payload.length + ' bytes'
      });

      // Send success message
      this.send({
        ...data,
        frameId,
        success: true,
        sentTo: address
      }, data);

    } catch (error) {
      logger.error(`XBee Out node execution failed: ${error.message}`, {
        service: 'flow-engine',
        nodeId: this.id,
        error: error.message
      });

      // Send error output instead of throwing
      this.send({
        ...data,
        error: error.message,
        success: false
      }, data);
    }
  }

  async stop() {
    logger.info('XBee Out node stopped', {
      service: 'flow-engine',
      nodeId: this.id
    });
  }
}

// Static type property for node registry
XBeeOutNode.type = 'xbee-out';

module.exports = XBeeOutNode;
