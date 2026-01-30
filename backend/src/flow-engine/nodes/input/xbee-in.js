const BaseNode = require('../base-node');
const { getXBeeManager } = require('../../../core/xbee-manager');
const logger = require('../../../core/logger');

class XBeeInNode extends BaseNode {
  constructor(config) {
    super(config);
    // Extract actual config from ReactFlow node structure
    // Config can be at: config.data.config (ReactFlow), config.config (flow engine), or config (direct)
    const actualConfig = config.data?.config || config.config || config;
    
    this.deviceAddress = actualConfig.deviceAddress || null; // null = receive from all devices
    // Use nullish coalescing to allow "0" and empty string as valid values
    this.payloadFilter = actualConfig.payloadFilter ?? null; // null = no filtering
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
    const payloadBytes = packet.payloadBytes || [];
    
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
        
        case 'button':
          // Semantic button filter: "button 0", "button 1 press", "cancel"
          // Florlink protocol: byte[0]=message ID, byte[1]=try, byte[2-3]=FW version, byte[4]=button number
          const filterLower = filter.toLowerCase();
          
          logger.info('Button filter check', {
            service: 'flow-engine',
            filter,
            filterLower,
            byte0: payloadBytes[0],
            byte1: payloadBytes[1],
            byte4: payloadBytes[4]
          });
          
          // Check for cancel action (byte[0] = 0x42 = 66)
          if (filterLower.includes('cancel')) {
            return payloadBytes[0] === 66;
          }
          
          // Extract button number from filter (e.g., "button 0", "0 press", just "0")
          const buttonMatch = filterLower.match(/(?:button\s*)?(\d+)(?:\s*(?:press|trigger|activate))?/);
          if (buttonMatch) {
            const buttonNumber = parseInt(buttonMatch[1]);
            logger.info('Button number match', {
              service: 'flow-engine',
              buttonNumber,
              expectedByte0: 64,
              actualByte0: payloadBytes[0],
              expectedByte4: buttonNumber,
              actualByte4: payloadBytes[4],
              matches: payloadBytes[0] === 64 && payloadBytes[4] === buttonNumber
            });
            // Check for button press: byte[0] = 0x40 (64) AND byte[4] = button number (Florlink protocol)
            return payloadBytes[0] === 64 && payloadBytes[4] === buttonNumber;
          }
          
          return false;
        
        case 'byte':
          // Match specific byte value(s) at index
          // Single: "1=0", "[1]=0", "1:0", "byte[1]=0"
          // Multiple (AND): "0=64 AND 1=0", "0=64 & 1=1", "0=0x40 AND 1=0"
          
          // Split by AND or & for multiple conditions
          const conditions = filter.split(/\s+(?:AND|&)\s+/i);
          
          for (const condition of conditions) {
            const byteMatch = condition.trim().match(/(?:byte)?\[?(\d+)\]?\s*[:=]\s*(\d+|0x[0-9a-fA-F]+)/);
            if (!byteMatch) {
              return false; // Invalid format
            }
            
            const index = parseInt(byteMatch[1]);
            const value = byteMatch[2].startsWith('0x') 
              ? parseInt(byteMatch[2], 16) 
              : parseInt(byteMatch[2]);
            
            // All conditions must match (AND logic)
            if (payloadBytes[index] !== value) {
              return false;
            }
          }
          
          return true; // All conditions matched
        
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
        // Log all received XBee packets at info level for debugging
        logger.info('XBee In node received packet', {
          service: 'flow-engine',
          nodeId: this.id,
          from: packet.address64,
          payload: packet.payload,
          payloadHex: packet.payloadHex
        });

        // Filter by device address if specified
        if (this.deviceAddress) {
          // Support multiple address formats:
          // - Full 64-bit address: "0013a20012345678"
          // - Short format: "12345678" (last 8 chars)
          // - Device name: matches packet.deviceName or packet.buttonName
          const addr = this.deviceAddress.toLowerCase();
          const fullAddr = packet.address64.toLowerCase();
          const shortAddr = fullAddr.slice(-8);
          const deviceName = (packet.deviceName || '').toLowerCase();
          const buttonName = (packet.buttonName || '').toLowerCase();
          
          const deviceMatch = 
            fullAddr === addr ||                    // Full address match
            shortAddr === addr ||                   // Short address match
            fullAddr.endsWith(addr) ||             // Partial address match
            deviceName === addr ||                  // Device name match
            buttonName === addr;                    // Button name match
          
          if (!deviceMatch) {
            logger.debug('XBee In address filter mismatch', {
              service: 'flow-engine',
              nodeId: this.id,
              filter: this.deviceAddress,
              address64: packet.address64,
              deviceName: packet.deviceName,
              buttonName: packet.buttonName
            });
            return;
          }
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
          topic: `xbee/${packet.address64}`,
          deviceName: packet.deviceName,
          buttonName: packet.buttonName
        };

        this.send(data);

        logger.debug('XBee In node sent data', {
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
