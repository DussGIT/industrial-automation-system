const BaseNode = require('../base-node');
const { getXBeeManager } = require('../../../core/xbee-manager');
const logger = require('../../../core/logger');

class XBeeInNode extends BaseNode {
  constructor(config) {
    super(config);
    this.deviceAddress = config.deviceAddress || null; // null = receive from all devices
    this.dataHandler = null;
  }

  async start() {
    try {
      const xbeeManager = getXBeeManager();

      // Create data handler
      this.dataHandler = (packet) => {
        // Filter by device address if specified
        if (this.deviceAddress && packet.address64 !== this.deviceAddress) {
          return;
        }

        const data = {
          payload: packet.payload,
          data: packet.data,
          address: packet.address64,
          address16: packet.address16,
          timestamp: packet.timestamp,
          topic: `xbee/${packet.address64}`
        };

        this.send(data);

        logger.debug('XBee In node received data', {
          service: 'flow-engine',
          nodeId: this.id,
          from: packet.address64
        });
      };

      // Subscribe to XBee data events
      xbeeManager.on('data', this.dataHandler);

      logger.info('XBee In node started', {
        service: 'flow-engine',
        nodeId: this.id,
        filter: this.deviceAddress || 'all devices'
      });
    } catch (error) {
      logger.error(`XBee In node start failed: ${error.message}`, {
        service: 'flow-engine',
        nodeId: this.id,
        error: error.message
      });
    }
  }

  async receive(data, sourcePort, targetPort) {
    // Input nodes don't process incoming messages
    // They only emit messages when data is received from XBee
  }

  async stop() {
    try {
      if (this.dataHandler) {
        const xbeeManager = getXBeeManager();
        xbeeManager.removeListener('data', this.dataHandler);
        this.dataHandler = null;
      }

      logger.info('XBee In node stopped', {
        service: 'flow-engine',
        nodeId: this.id
      });
    } catch (error) {
      logger.error(`XBee In node stop failed: ${error.message}`, {
        service: 'flow-engine',
        nodeId: this.id,
        error: error.message
      });
    }
  }
}

// Static type property for node registry
XBeeInNode.type = 'xbee-in';

module.exports = XBeeInNode;
