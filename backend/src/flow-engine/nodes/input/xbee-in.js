const BaseNode = require('../base-node');
const { getXBeeManager } = require('../../../core/xbee-manager');
const logger = require('../../../core/logger');

class XBeeInNode extends BaseNode {
  constructor(config) {
    super(config);
    // Extract actual config from ReactFlow node structure
    const actualConfig = config.data?.config || config;
    this.deviceAddress = actualConfig.deviceAddress || null; // null = receive from all devices
    this.payloadFilter = actualConfig.payloadFilter || null; // null = no filtering
    this.filterType = actualConfig.filterType || 'contains'; // contains, equals, startsWith, regex
    this.dataHandler = null;
  }

  matchesPayloadFilter(packet) {
    // No filter = match all
    if (!this.payloadFilter || this.payloadFilter.trim() === '') {
      return true;
    }

    const filter = this.payloadFilter.trim();
    const payloadHex = packet.payloadHex || '';
    const payloadText = packet.payload || '';
    
    try {
      switch (this.filterType) {
        case 'equals':
          // Check if hex or text matches exactly
          return payloadHex.toLowerCase() === filter.toLowerCase() || 
                 payloadText === filter;
        
        case 'startsWith':
          // Check if hex or text starts with filter
          return payloadHex.toLowerCase().startsWith(filter.toLowerCase()) ||
                 payloadText.startsWith(filter);
        
        case 'regex':
          // Test regex against hex and text
          const regex = new RegExp(filter);
          return regex.test(payloadHex) || regex.test(payloadText);
        
        case 'contains':
        default:
          // Check if hex or text contains filter (with or without spaces)
          const filterNoSpaces = filter.replace(/\s/g, '');
          const hexNoSpaces = payloadHex.replace(/\s/g, '');
          return hexNoSpaces.toLowerCase().includes(filterNoSpaces.toLowerCase()) ||
                 payloadText.toLowerCase().includes(filter.toLowerCase());
      }
    } catch (error) {
      logger.warn('XBee In payload filter error', {
        service: 'flow-engine',
        nodeId: this.id,
        error: error.message
      });
      return true; // On error, allow the message through
    }
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

        // Filter by payload if specified
        if (!this.matchesPayloadFilter(packet)) {
          return;
        }

        const data = {
          payload: packet.payload,
          payloadHex: packet.payloadHex,
          payloadBytes: packet.payloadBytes,
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
          from: packet.address64,
          payloadHex: packet.payloadHex
        });
      };

      // Subscribe to XBee data events
      xbeeManager.on('data', this.dataHandler);

      logger.info('XBee In node started', {
        service: 'flow-engine',
        nodeId: this.id,
        filter: this.deviceAddress || 'all devices',
        payloadFilter: this.payloadFilter || 'none',
        filterType: this.filterType
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
