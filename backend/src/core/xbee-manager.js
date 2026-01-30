const EventEmitter = require('events');
const { SerialPort } = require('serialport');
const logger = require('./logger');
const { getDb } = require('./database');

/**
 * Florlink Protocol Message IDs
 */
const FLORLINK_MSG = {
  BUTTON_PRESS: 0x40,
  BUTTON_PRESS_ACK: 0x41,
  BUTTON_CANCEL: 0x42,
  BUTTON_CANCEL_ACK: 0x43,
  HEARTBEAT: 0x44,
  CANCEL_BUTTON_ACK: 0x46,
  LIGHT_TOWER_CONTROL: 0x47,
  LIGHT_TOWER_ACK: 0x48
};

/**
 * XBee Manager - Manages communication with Digi XBee modules
 * Supports XBee ZigBee PRO modules in API mode
 * Implements Florlink messaging protocol with deduplication and ACK
 */
class XBeeManager extends EventEmitter {
  constructor() {
    super();
    this.serialPort = null;
    this.isConnected = false;
    this.frameId = 1;
    this.devices = new Map(); // Known XBee devices
    this.pendingCommands = new Map(); // Pending API frames waiting for response
    this.port = null;
    this.baudRate = 9600;
    this.buffer = Buffer.alloc(0); // Buffer for incoming data
    
    // Florlink protocol: deduplication cache
    // Key: "address64:messageId:button:timestamp"
    // Value: { timestamp, processed }
    this.messageCache = new Map();
    this.CACHE_TIMEOUT_MS = 30000; // 30 seconds
    
    // Cleanup cache periodically
    setInterval(() => this.cleanupMessageCache(), 10000);
  }

  /**
   * Initialize XBee connection
   */
  async initialize(port = '/dev/ttyUSB0', baudRate = 9600) {
    try {
      this.port = port;
      this.baudRate = baudRate;

      logger.info('Initializing XBee Manager', {
        service: 'xbee',
        port,
        baudRate
      });

      // Load devices from database
      this.loadDevicesFromDb();

      this.serialPort = new SerialPort({
        path: port,
        baudRate: baudRate,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        flowControl: false
      });

      // Set up event handlers
      this.serialPort.on('open', () => this.handleOpen());
      this.serialPort.on('data', (data) => this.handleData(data));
      this.serialPort.on('error', (error) => this.handleError(error));
      this.serialPort.on('close', () => this.handleClose());

      logger.info('XBee Manager initialized successfully', {
        service: 'xbee',
        port
      });

      return true;
    } catch (error) {
      logger.warn(`XBee Manager could not connect to ${port}: ${error.message}`, {
        service: 'xbee',
        error: error.message
      });
      this.isConnected = false;
      this.serialPort = null;
      return false;
    }
  }

  /**
   * Handle serial port open event
   */
  handleOpen() {
    this.isConnected = true;
    logger.info('XBee serial port opened', { service: 'xbee' });
    this.emit('connected');

    // Request network discovery after connection
    setTimeout(() => this.discoverNetwork(), 1000);
  }

  /**
   * Handle incoming data from XBee
   */
  handleData(data) {
    try {
      // Log ANY incoming data
      logger.info('XBee RAW data received', {
        service: 'xbee',
        bytes: data.length,
        hex: data.toString('hex')
      });
      
      // Append new data to buffer
      this.buffer = Buffer.concat([this.buffer, data]);
      
      // Process complete frames from buffer
      while (this.buffer.length > 0) {
        // Look for frame start delimiter
        const startIndex = this.buffer.indexOf(0x7E);
        
        if (startIndex === -1) {
          // No frame start found, clear buffer
          this.buffer = Buffer.alloc(0);
          break;
        }
        
        if (startIndex > 0) {
          // Discard data before frame start
          this.buffer = this.buffer.slice(startIndex);
        }
        
        // Need at least 4 bytes: 0x7E + length (2 bytes) + 1 byte
        if (this.buffer.length < 4) {
          break;
        }
        
        // Get frame length
        const length = (this.buffer[1] << 8) | this.buffer[2];
        const frameSize = 4 + length; // 0x7E + 2 length bytes + length + checksum
        
        // Wait for complete frame
        if (this.buffer.length < frameSize) {
          break;
        }
        
        // Extract frame
        const frameBuffer = this.buffer.slice(0, frameSize);
        this.buffer = this.buffer.slice(frameSize);
        
        // Parse frame
        const frame = this.parseFrame(frameBuffer);
        
        if (frame) {
          logger.debug('Received XBee frame', {
            service: 'xbee',
            frameType: frame.type,
            data: frame
          });

          this.handleFrame(frame);
        }
      }
    } catch (error) {
      logger.error(`Error handling XBee data: ${error.message}`, {
        service: 'xbee',
        error: error.message
      });
    }
  }

  /**
   * Parse XBee API frame from buffer
   */
  parseFrame(buffer) {
    // XBee API frame structure:
    // 0x7E | Length (2 bytes) | Frame Data | Checksum
    
    if (buffer.length < 4 || buffer[0] !== 0x7E) {
      logger.debug('Invalid frame start or too short', { 
        service: 'xbee',
        length: buffer.length,
        firstByte: buffer[0]?.toString(16),
        hex: buffer.toString('hex')
      });
      return null;
    }

    const length = (buffer[1] << 8) | buffer[2];
    const frameType = buffer[3];
    const frameData = buffer.slice(4, 4 + length - 1);
    const checksum = buffer[4 + length - 1];

    // Verify checksum
    let sum = 0;
    for (let i = 3; i < 4 + length - 1; i++) {
      sum += buffer[i];
    }
    const calculatedChecksum = 0xFF - (sum & 0xFF);

    if (checksum !== calculatedChecksum) {
      logger.warn('XBee frame checksum mismatch', { 
        service: 'xbee',
        expected: calculatedChecksum.toString(16),
        received: checksum?.toString(16),
        length: length,
        frameType: frameType?.toString(16),
        hex: buffer.toString('hex').substring(0, 50)
      });
      return null;
    }

    return {
      type: frameType,
      data: frameData,
      raw: buffer
    };
  }

  /**
   * Handle parsed XBee frame
   */
  handleFrame(frame) {
    switch (frame.type) {
      case 0x90: // Receive Packet (ZigBee)
        this.handleReceivePacket(frame);
        break;
      case 0x8B: // Transmit Status
        this.handleTransmitStatus(frame);
        break;
      case 0x88: // AT Command Response
        this.handleATCommandResponse(frame);
        break;
      case 0x95: // Node Identification Indicator
        this.handleNodeIdentification(frame);
        break;
      default:
        logger.debug(`Unhandled XBee frame type: 0x${frame.type.toString(16)}`, {
          service: 'xbee'
        });
    }
  }

  /**
   * Parse Florlink protocol message from payload
   * Returns null if not a valid Florlink message
   */
  parseFlorlinkMessage(payload) {
    if (!payload || payload.length < 5) {
      return null; // Not enough bytes for Florlink message
    }

    const messageId = payload[0];
    const tryNum = payload[1];
    const fwVersionHigh = payload[2];
    const fwVersionLow = payload[3];
    const fwVersion = (fwVersionHigh << 8) | fwVersionLow;

    // Check if this is a known Florlink message ID
    const isFlorlinkMsg = Object.values(FLORLINK_MSG).includes(messageId);
    if (!isFlorlinkMsg) {
      return null;
    }

    const message = {
      messageId,
      messageIdHex: `0x${messageId.toString(16).padStart(2, '0')}`,
      tryNum,
      fwVersion,
      fwVersionHex: `0x${fwVersion.toString(16).padStart(4, '0')}`
    };

    // Parse message-specific data
    switch (messageId) {
      case FLORLINK_MSG.BUTTON_PRESS:
        if (payload.length >= 5) {
          message.buttonNum = payload[4];
          message.messageType = 'button_press';
        }
        break;

      case FLORLINK_MSG.BUTTON_CANCEL:
        if (payload.length >= 6) {
          message.buttonNum = payload[4];
          message.reason = payload[5]; // 0x01=Associate, 0x02=Timeout
          message.messageType = 'button_cancel';
        }
        break;

      case FLORLINK_MSG.HEARTBEAT:
        if (payload.length >= 7) {
          message.contactsStatus = payload[4];
          message.batteryVoltage = (payload[5] << 8) | payload[6];
          message.messageType = 'heartbeat';
        }
        break;

      default:
        message.messageType = 'unknown_florlink';
    }

    return message;
  }

  /**
   * Generate cache key for message deduplication
   */
  getMessageCacheKey(address64, florlinkMsg) {
    // Use button press time window for dedup (ignore exact tryNum)
    // Key based on: device + message type + button + time window (1 second)
    const timeWindow = Math.floor(Date.now() / 1000); // 1-second buckets
    return `${address64}:${florlinkMsg.messageId}:${florlinkMsg.buttonNum || 0}:${timeWindow}`;
  }

  /**
   * Check if message was already processed (deduplication)
   */
  isMessageProcessed(address64, florlinkMsg) {
    const cacheKey = this.getMessageCacheKey(address64, florlinkMsg);
    const cached = this.messageCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < this.CACHE_TIMEOUT_MS)) {
      return true; // Already processed recently
    }
    
    return false;
  }

  /**
   * Mark message as processed in cache
   */
  markMessageProcessed(address64, florlinkMsg) {
    const cacheKey = this.getMessageCacheKey(address64, florlinkMsg);
    this.messageCache.set(cacheKey, {
      timestamp: Date.now(),
      processed: true
    });
  }

  /**
   * Cleanup old entries from message cache
   */
  cleanupMessageCache() {
    const now = Date.now();
    for (const [key, value] of this.messageCache.entries()) {
      if (now - value.timestamp > this.CACHE_TIMEOUT_MS) {
        this.messageCache.delete(key);
      }
    }
  }

  /**
   * Send Florlink Button Press ACK
   */
  async sendButtonPressAck(address64, florlinkMsg) {
    try {
      const ackPayload = Buffer.from([
        FLORLINK_MSG.BUTTON_PRESS_ACK,  // Message ID
        florlinkMsg.tryNum,              // Echo back the Try number
        florlinkMsg.fwVersion >> 8,      // Firmware version high byte
        florlinkMsg.fwVersion & 0xFF,    // Firmware version low byte
        florlinkMsg.buttonNum            // Button being ACKed
      ]);

      await this.sendData(address64, ackPayload);

      logger.info('Sent Florlink Button Press ACK', {
        service: 'xbee',
        to: address64,
        button: florlinkMsg.buttonNum,
        try: florlinkMsg.tryNum,
        ackHex: ackPayload.toString('hex')
      });
    } catch (error) {
      logger.error(`Failed to send Button Press ACK: ${error.message}`, {
        service: 'xbee',
        to: address64,
        error: error.message
      });
    }
  }

  /**
   * Send Florlink Button Cancel ACK
   */
  async sendButtonCancelAck(address64, florlinkMsg) {
    try {
      const ackPayload = Buffer.from([
        FLORLINK_MSG.BUTTON_CANCEL_ACK,  // Message ID
        florlinkMsg.tryNum,               // Echo back the Try number
        florlinkMsg.fwVersion >> 8,       // Firmware version high byte
        florlinkMsg.fwVersion & 0xFF,     // Firmware version low byte
        florlinkMsg.buttonNum             // Button being ACKed
      ]);

      await this.sendData(address64, ackPayload);

      logger.info('Sent Florlink Button Cancel ACK', {
        service: 'xbee',
        to: address64,
        button: florlinkMsg.buttonNum,
        try: florlinkMsg.tryNum
      });
    } catch (error) {
      logger.error(`Failed to send Button Cancel ACK: ${error.message}`, {
        service: 'xbee',
        to: address64,
        error: error.message
      });
    }
  }

  /**
   * Handle received data packet from remote XBee
   */
  /**
   * Handle received data packet from remote XBee
   */
  handleReceivePacket(frame) {
    const data = frame.data;
    const address64 = data.slice(0, 8).toString('hex');
    const address16 = data.slice(8, 10).toString('hex');
    const options = data[10];
    const payload = data.slice(11);

    // Try to interpret payload in multiple formats
    const payloadHex = payload.toString('hex');
    const payloadAscii = payload.toString('ascii');
    const payloadUtf8 = payload.toString('utf8');
    
    // Check if payload is printable ASCII
    const isPrintable = payload.every(byte => byte >= 32 && byte <= 126);

    // Get device info from database/cache
    let deviceName = `XBee-${address64.slice(-8)}`;
    let buttonName = null;
    
    const device = this.devices.get(address64);
    logger.info(`[PACKET DEBUG] Device lookup for ${address64}: ${device ? 'FOUND' : 'NOT FOUND'}`, {
      service: 'xbee',
      deviceName: device?.name,
      hasDevice: !!device
    });
    if (device && device.name) {
      deviceName = device.name;
      buttonName = device.name; // Use device name as button name
    }

    // Auto-discover device when we receive data from it
    if (!this.devices.has(address64)) {
      const newDevice = {
        address64,
        address16,
        name: `XBee-${address64.slice(-8)}`,
        nodeIdentifier: `XBee-${address64.slice(-8)}`,
        deviceType: 'Unknown',
        status: 'Active',
        lastSeen: new Date().toISOString()
      };
      this.devices.set(address64, newDevice);
      this.saveDeviceToDb(newDevice);
      
      logger.info('Auto-discovered XBee device', {
        service: 'xbee',
        address64,
        name: newDevice.name
      });
      
      this.emit('device-discovered', newDevice);
    } else {
      // Update last seen timestamp
      const existingDevice = this.devices.get(address64);
      existingDevice.lastSeen = new Date().toISOString();
      existingDevice.status = 'Active';
      this.saveDeviceToDb(existingDevice);
    }

    // Try to parse as Florlink protocol message
    const florlinkMsg = this.parseFlorlinkMessage(payload);
    
    if (florlinkMsg) {
      logger.info('Received Florlink message', {
        service: 'xbee',
        from: address64,
        deviceName,
        messageType: florlinkMsg.messageType,
        messageId: florlinkMsg.messageIdHex,
        try: florlinkMsg.tryNum,
        button: florlinkMsg.buttonNum,
        fwVersion: florlinkMsg.fwVersionHex,
        payloadHex
      });

      // Handle based on message type
      if (florlinkMsg.messageType === 'button_press') {
        // Check if already processed (deduplication)
        const isDuplicate = this.isMessageProcessed(address64, florlinkMsg);
        
        if (isDuplicate) {
          logger.info('Duplicate button press detected (retry) - sending ACK but not processing', {
            service: 'xbee',
            from: address64,
            deviceName,
            button: florlinkMsg.buttonNum,
            try: florlinkMsg.tryNum
          });
        } else {
          logger.info('New button press detected - will process and ACK', {
            service: 'xbee',
            from: address64,
            deviceName,
            button: florlinkMsg.buttonNum,
            try: florlinkMsg.tryNum
          });
          
          // Mark as processed
          this.markMessageProcessed(address64, florlinkMsg);
        }

        // ALWAYS send ACK (even for duplicates) to stop device retries
        this.sendButtonPressAck(address64, florlinkMsg);

        // Only emit to flows if NOT a duplicate
        if (!isDuplicate) {
          const packet = {
            address64,
            address16,
            options,
            payload: isPrintable ? payloadUtf8 : payloadHex,
            payloadHex,
            payloadAscii: isPrintable ? payloadAscii : null,
            payloadUtf8: isPrintable ? payloadUtf8 : null,
            payloadBytes: Array.from(payload),
            payloadLength: payload.length,
            isPrintable,
            data: payload,
            timestamp: new Date().toISOString(),
            deviceName,
            buttonName,
            // Florlink protocol fields
            florlink: {
              messageType: florlinkMsg.messageType,
              messageId: florlinkMsg.messageId,
              messageIdHex: florlinkMsg.messageIdHex,
              tryNum: florlinkMsg.tryNum,
              fwVersion: florlinkMsg.fwVersion,
              fwVersionHex: florlinkMsg.fwVersionHex,
              buttonNum: florlinkMsg.buttonNum
            }
          };

          this.emit('data', packet);
        }
        
        return; // Exit after handling button press
      }

      if (florlinkMsg.messageType === 'button_cancel') {
        // Check if already processed
        const isDuplicate = this.isMessageProcessed(address64, florlinkMsg);
        
        // ALWAYS send ACK
        this.sendButtonCancelAck(address64, florlinkMsg);

        // Only emit if not duplicate
        if (!isDuplicate) {
          this.markMessageProcessed(address64, florlinkMsg);
          
          const packet = {
            address64,
            address16,
            options,
            payload: payloadHex,
            payloadHex,
            payloadBytes: Array.from(payload),
            payloadLength: payload.length,
            isPrintable: false,
            data: payload,
            timestamp: new Date().toISOString(),
            deviceName,
            buttonName,
            florlink: {
              messageType: florlinkMsg.messageType,
              messageId: florlinkMsg.messageId,
              tryNum: florlinkMsg.tryNum,
              fwVersion: florlinkMsg.fwVersion,
              buttonNum: florlinkMsg.buttonNum,
              cancelReason: florlinkMsg.reason === 1 ? 'associate' : 'timeout'
            }
          };

          this.emit('data', packet);
        }
        
        return;
      }

      if (florlinkMsg.messageType === 'heartbeat') {
        // Heartbeats are NOT ACKed per protocol
        logger.info('Received Florlink heartbeat', {
          service: 'xbee',
          from: address64,
          deviceName,
          contacts: florlinkMsg.contactsStatus,
          battery: florlinkMsg.batteryVoltage
        });

        const packet = {
          address64,
          address16,
          options,
          payload: payloadHex,
          payloadHex,
          payloadBytes: Array.from(payload),
          payloadLength: payload.length,
          isPrintable: false,
          data: payload,
          timestamp: new Date().toISOString(),
          deviceName,
          buttonName,
          florlink: {
            messageType: florlinkMsg.messageType,
            messageId: florlinkMsg.messageId,
            contactsStatus: florlinkMsg.contactsStatus,
            batteryVoltage: florlinkMsg.batteryVoltage
          }
        };

        this.emit('data', packet);
        return;
      }
    }

    // Non-Florlink message or unknown Florlink message - pass through as before
    const packet = {
      address64,
      address16,
      options,
      payload: isPrintable ? payloadUtf8 : payloadHex,
      payloadHex,
      payloadAscii: isPrintable ? payloadAscii : null,
      payloadUtf8: isPrintable ? payloadUtf8 : null,
      payloadBytes: Array.from(payload),
      payloadLength: payload.length,
      isPrintable,
      data: payload,
      timestamp: new Date().toISOString(),
      deviceName,
      buttonName
    };

    logger.info('Received XBee packet', {
      service: 'xbee',
      from: address64,
      address16,
      payloadLength: payload.length,
      payloadHex,
      payloadAscii: isPrintable ? payloadAscii : '(binary data)',
      payloadUtf8: isPrintable ? payloadUtf8 : '(binary data)',
      payloadBytes: Array.from(payload),
      options: `0x${options.toString(16).padStart(2, '0')}`
    });

    // Auto-discover device when we receive data from it
    if (!this.devices.has(address64)) {
      const device = {
        address64,
        address16,
        name: `XBee-${address64.slice(-8)}`,
        nodeIdentifier: `XBee-${address64.slice(-8)}`,
        deviceType: 'Unknown',
        status: 'Active',
        lastSeen: new Date().toISOString()
      };
      this.devices.set(address64, device);
      this.saveDeviceToDb(device);
      
      logger.info('Auto-discovered XBee device', {
        service: 'xbee',
        address64,
        name: device.name
      });
      
      this.emit('device-discovered', device);
    } else {
      // Update last seen timestamp
      const device = this.devices.get(address64);
      device.lastSeen = new Date().toISOString();
      device.status = 'Active';
      this.saveDeviceToDb(device);
    }

    this.emit('data', packet);
  }

  /**
   * Handle transmit status response
   */
  handleTransmitStatus(frame) {
    const frameId = frame.data[0];
    const address16 = frame.data.slice(1, 3).toString('hex');
    const retryCount = frame.data[3];
    const deliveryStatus = frame.data[4];
    const discoveryStatus = frame.data[5];

    logger.debug('XBee transmit status', {
      service: 'xbee',
      frameId,
      status: deliveryStatus === 0 ? 'success' : 'failed',
      retries: retryCount
    });

    this.emit('transmit-status', {
      frameId,
      success: deliveryStatus === 0,
      retryCount
    });
  }

  /**
   * Handle AT command response
   */
  handleATCommandResponse(frame) {
    const frameId = frame.data[0];
    const command = frame.data.slice(1, 3).toString('ascii');
    const status = frame.data[3];
    const value = frame.data.slice(4);

    logger.debug('XBee AT command response', {
      service: 'xbee',
      command,
      status: status === 0 ? 'OK' : 'ERROR'
    });

    this.emit('at-response', { command, status, value });
  }

  /**
   * Handle node identification (discovery response)
   */
  handleNodeIdentification(frame) {
    const data = frame.data;
    const address64 = data.slice(0, 8).toString('hex');
    const address16 = data.slice(8, 10).toString('hex');
    const nodeIdentifier = this.extractString(data.slice(11));

    const device = {
      address64,
      address16,
      name: nodeIdentifier,
      nodeIdentifier,
      deviceType: 'Unknown',
      status: 'Active',
      lastSeen: new Date().toISOString()
    };

    this.devices.set(address64, device);
    this.saveDeviceToDb(device);

    logger.info('Discovered XBee device', {
      service: 'xbee',
      address: address64,
      name: nodeIdentifier
    });

    this.emit('device-discovered', device);
  }

  /**
   * Extract null-terminated string from buffer
   */
  extractString(buffer) {
    const nullIndex = buffer.indexOf(0);
    return buffer.slice(0, nullIndex > -1 ? nullIndex : buffer.length).toString('ascii');
  }

  /**
   * Send data to remote XBee device
   */
  async sendData(address, data) {
    if (!this.isConnected) {
      throw new Error('XBee not connected');
    }

    const frameId = this.getNextFrameId();
    
    // Build Transmit Request frame (0x10)
    const address64Buffer = Buffer.from(address.padStart(16, '0'), 'hex');
    const address16Buffer = Buffer.from('FFFE', 'hex'); // Unknown 16-bit address
    const broadcastRadius = 0x00;
    const options = 0x00;
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    const frameData = Buffer.concat([
      Buffer.from([0x10, frameId]), // Frame type and ID
      address64Buffer,
      address16Buffer,
      Buffer.from([broadcastRadius, options]),
      dataBuffer
    ]);

    await this.sendFrame(frameData);

    logger.info('Sent XBee data', {
      service: 'xbee',
      to: address,
      frameId,
      length: dataBuffer.length
    });

    return frameId;
  }

  /**
   * Send XBee API frame
   */
  async sendFrame(frameData) {
    const length = frameData.length;
    const lengthBuffer = Buffer.from([(length >> 8) & 0xFF, length & 0xFF]);

    // Calculate checksum
    let sum = 0;
    for (let i = 0; i < frameData.length; i++) {
      sum += frameData[i];
    }
    const checksum = 0xFF - (sum & 0xFF);

    const frame = Buffer.concat([
      Buffer.from([0x7E]), // Start delimiter
      lengthBuffer,
      frameData,
      Buffer.from([checksum])
    ]);

    return new Promise((resolve, reject) => {
      this.serialPort.write(frame, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Send AT command to local XBee
   */
  async sendATCommand(command, value = null) {
    const frameId = this.getNextFrameId();
    const commandBuffer = Buffer.from(command, 'ascii');
    const valueBuffer = value ? (Buffer.isBuffer(value) ? value : Buffer.from(value)) : Buffer.alloc(0);

    const frameData = Buffer.concat([
      Buffer.from([0x08, frameId]), // AT Command frame type and ID
      commandBuffer,
      valueBuffer
    ]);

    await this.sendFrame(frameData);

    logger.debug('Sent AT command', {
      service: 'xbee',
      command,
      frameId
    });

    return frameId;
  }

  /**
   * Discover XBee network devices
   */
  async discoverNetwork() {
    logger.info('Starting XBee network discovery', { service: 'xbee' });
    
    // Send Node Discovery (ND) AT command
    await this.sendATCommand('ND');
  }

  /**
   * Load devices from database
   */
  loadDevicesFromDb() {
    try {
      const db = getDb();
      const stmt = db.prepare('SELECT * FROM devices WHERE type = ?');
      const rows = stmt.all('xbee');
      
      for (const row of rows) {
        // Check device_names table for custom name (takes precedence)
        const customNameRow = db.prepare('SELECT name FROM device_names WHERE address = ? AND type = ?')
          .get(row.address, 'xbee');
        
        const deviceName = customNameRow?.name || row.name || `XBee-${row.address.slice(-8)}`;
        
        logger.info(`[DB LOAD] address: ${row.address}, device_names: "${customNameRow?.name || 'none'}", devices.name: "${row.name}", final: "${deviceName}"`, {
          service: 'xbee'
        });
        
        const device = {
          address64: row.address,
          address16: row.metadata ? JSON.parse(row.metadata).address16 : '',
          name: deviceName,
          nodeIdentifier: deviceName,
          deviceType: row.metadata ? JSON.parse(row.metadata).deviceType : 'Unknown',
          status: row.status || 'Inactive',
          lastSeen: row.last_seen ? new Date(row.last_seen * 1000).toISOString() : null
        };
        this.devices.set(row.address, device);
        logger.info(`Loaded XBee device from DB: ${row.address} with name: ${device.name}`, {
          service: 'xbee'
        });
      }
      
      logger.info(`Loaded ${rows.length} XBee devices from database`, {
        service: 'xbee'
      });
    } catch (error) {
      logger.warn(`Failed to load XBee devices from database: ${error.message}`, {
        service: 'xbee',
        error: error.message
      });
    }
  }

  /**
   * Update device name in memory (called when user renames device)
   */
  updateDeviceName(address, newName) {
    const device = this.devices.get(address);
    if (device) {
      device.name = newName;
      device.nodeIdentifier = newName;
      logger.info(`Updated device name in memory: ${address} -> "${newName}"`, {
        service: 'xbee'
      });
    } else {
      logger.warn(`Cannot update device name - device not found: ${address}`, {
        service: 'xbee'
      });
    }
  }

  /**
   * Remove device from memory (called when user deletes device)
   */
  removeDevice(address) {
    if (this.devices.has(address)) {
      this.devices.delete(address);
      logger.info(`Removed device from memory: ${address}`, {
        service: 'xbee'
      });
    } else {
      logger.warn(`Cannot remove device - not found in memory: ${address}`, {
        service: 'xbee'
      });
    }
  }

  /**
   * Save device to database
   */
  saveDeviceToDb(device) {
    try {
      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO devices (address, type, name, capabilities, metadata, status, last_seen, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
        ON CONFLICT(address) DO UPDATE SET
          name = excluded.name,
          metadata = excluded.metadata,
          status = excluded.status,
          last_seen = excluded.last_seen,
          updated_at = strftime('%s', 'now')
      `);
      
      const lastSeenTimestamp = device.lastSeen ? Math.floor(new Date(device.lastSeen).getTime() / 1000) : null;
      const metadata = JSON.stringify({
        address16: device.address16,
        deviceType: device.deviceType || 'Unknown',
        nodeIdentifier: device.nodeIdentifier
      });
      
      stmt.run(
        device.address64,
        'xbee',
        device.name,
        null, // capabilities (not applicable for XBee)
        metadata,
        device.status || 'Active',
        lastSeenTimestamp
      );
    } catch (error) {
      logger.warn(`Failed to save XBee device to database: ${error.message}`, {
        service: 'xbee',
        error: error.message
      });
    }
  }

  /**
   * Get all discovered devices
   */
  getAllDevices() {
    return Array.from(this.devices.values());
  }

  /**
   * Get device by address
   */
  getDevice(address) {
    return this.devices.get(address);
  }

  /**
   * Get next frame ID
   */
  getNextFrameId() {
    const id = this.frameId;
    this.frameId = (this.frameId % 255) + 1;
    return id;
  }

  /**
   * Handle serial port error
   */
  handleError(error) {
    logger.warn(`XBee serial port error: ${error.message}`, {
      service: 'xbee',
      error: error.message
    });
    this.isConnected = false;
    // Don't re-emit error to prevent uncaught exception
    // Just log it and mark as disconnected
  }

  /**
   * Handle serial port close
   */
  handleClose() {
    this.isConnected = false;
    logger.warn('XBee serial port closed', { service: 'xbee' });
    this.emit('disconnected');
  }

  /**
   * Check if XBee is connected
   */
  isReady() {
    return this.isConnected;
  }

  /**
   * Remove a device from the network
   */
  async removeDevice(address) {
    try {
      // Remove from memory
      const removed = this.devices.delete(address);
      
      if (removed) {
        // Remove from database (devices table, not xbee_devices)
        const db = getDb();
        const deleteStmt = db.prepare('DELETE FROM devices WHERE address = ? AND type = ?');
        deleteStmt.run(address, 'xbee');
        
        logger.info(`XBee device removed: ${address}`, { service: 'xbee' });
        this.emit('device-removed', address);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error removing XBee device ${address}: ${error.message}`, {
        service: 'xbee',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Close XBee connection
   */
  async close() {
    if (this.serialPort && this.serialPort.isOpen) {
      return new Promise((resolve) => {
        this.serialPort.close(() => {
          logger.info('XBee connection closed', { service: 'xbee' });
          resolve();
        });
      });
    }
  }
}

// Singleton instance
let xbeeManagerInstance = null;

function getXBeeManager() {
  if (!xbeeManagerInstance) {
    xbeeManagerInstance = new XBeeManager();
  }
  return xbeeManagerInstance;
}

module.exports = {
  XBeeManager,
  getXBeeManager
};
