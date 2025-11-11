const BaseInterface = require('../base-interface');
const { SerialPort } = require('serialport');

/**
 * Motorola DLR Radio Interface
 * Provides control and communication with Motorola DLR digital radios
 */
class MotorolaDLRInterface extends BaseInterface {
  static type = 'radio-motorola-dlr';

  constructor(config) {
    super(config);
    this.port = null;
    this.serialConfig = {
      path: this.config.port || '/dev/ttyUSB0',
      baudRate: this.config.baudRate || 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none'
    };
    this.radioId = this.config.radioId || 1;
  }

  async connect() {
    try {
      this.log(`Connecting to Motorola DLR on ${this.serialConfig.path}`);
      
      this.port = new SerialPort(this.serialConfig);
      
      return new Promise((resolve, reject) => {
        this.port.on('open', () => {
          this.setStatus('connected');
          this.stats.connected = Date.now();
          this.log('Connected to Motorola DLR');
          
          this.port.on('data', (data) => this.handleData(data));
          this.port.on('error', (err) => this.handleError(err));
          
          this.initialize().then(resolve).catch(reject);
        });
        
        this.port.on('error', reject);
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async disconnect() {
    if (this.port && this.port.isOpen) {
      return new Promise((resolve) => {
        this.port.close(() => {
          this.setStatus('disconnected');
          this.log('Disconnected from Motorola DLR');
          resolve();
        });
      });
    }
  }

  async initialize() {
    // Query radio status
    await this.queryStatus();
    this.log('DLR radio initialized');
  }

  async queryStatus() {
    // Send status query command
    // Protocol: AT+STATUS\r
    return this.sendCommand('AT+STATUS\r');
  }

  async sendTextMessage(message, destination, options = {}) {
    try {
      // Check for clear channel if requested
      if (options.checkClear !== false) { // Default to checking
        const isClear = await this.waitForClearChannel(options.clearTimeout || 5000);
        
        if (!isClear && !options.forceTransmit) {
          throw new Error('Channel busy - transmission aborted');
        }
      }
      
      // Send text message via DLR
      // Format: AT+MSG=destination,message\r
      const command = `AT+MSG=${destination},${message}\r`;
      await this.sendCommand(command);
      
      this.stats.messagesSent++;
      this.log(`Text message sent to ${destination}`);
      
      return { success: true };
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async getLocation() {
    try {
      // Request GPS location from radio
      const command = 'AT+GPS\r';
      const response = await this.sendCommand(command);
      
      // Parse GPS response
      // This would return lat/lon coordinates
      return {
        latitude: null,  // Parse from response
        longitude: null, // Parse from response
        timestamp: Date.now()
      };
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async setEmergency(active) {
    // Trigger or clear emergency alert
    const command = active ? 'AT+EMERGENCY=1\r' : 'AT+EMERGENCY=0\r';
    await this.sendCommand(command);
    this.log(`Emergency ${active ? 'activated' : 'cleared'}`);
  }

  async checkClearChannel() {
    // Check if channel is clear using DLR's carrier sense
    try {
      // Query channel busy status
      const command = 'AT+CARRIER?\r';
      const response = await this.sendCommand(command);
      
      // Parse response
      // Expected: +CARRIER:0 (clear) or +CARRIER:1 (busy)
      const match = response.match(/\+CARRIER:(\d+)/);
      
      if (match) {
        const carrierDetected = parseInt(match[1]) === 1;
        
        this.log(`Channel check: Carrier=${carrierDetected ? 'BUSY' : 'CLEAR'}`, 'debug');
        
        return {
          clear: !carrierDetected,
          carrierDetected: carrierDetected
        };
      }
      
      // Alternative: Use RSSI if carrier sense not available
      const rssiCommand = 'AT+RSSI?\r';
      const rssiResponse = await this.sendCommand(rssiCommand);
      const rssiMatch = rssiResponse.match(/\+RSSI:(-?\d+)/);
      
      if (rssiMatch) {
        const rssi = parseInt(rssiMatch[1]);
        const threshold = this.config.clearChannelThreshold || -90;
        const isClear = rssi < threshold;
        
        return {
          clear: isClear,
          rssi: rssi,
          threshold: threshold
        };
      }
      
      // If we can't determine, assume busy for safety
      return { clear: false, error: 'Unable to determine channel status' };
    } catch (error) {
      this.handleError(error);
      return { clear: false, error: error.message };
    }
  }

  async waitForClearChannel(timeout = 5000) {
    // Wait for channel to become clear, up to timeout
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const result = await this.checkClearChannel();
      
      if (result.clear) {
        this.log('Channel is clear, ready to transmit');
        return true;
      }
      
      // Wait a bit before checking again (DLR recommended 50-100ms)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.log('Timeout waiting for clear channel', 'warn');
    return false;
  }

  async read(params) {
    const { command } = params;
    
    switch (command) {
      case 'status':
        return this.queryStatus();
      case 'location':
        return this.getLocation();
      case 'clearChannel':
        return this.checkClearChannel();
      default:
        throw new Error(`Unknown read command: ${command}`);
    }
  }

  async write(params) {
    if (!this.port || !this.port.isOpen) {
      throw new Error('Port not open');
    }

    const { type, data } = params;
    
    switch (type) {
      case 'message':
        return this.sendTextMessage(data.message, data.destination);
      case 'emergency':
        return this.setEmergency(data.active);
      case 'command':
        return this.sendCommand(data.command);
      default:
        throw new Error(`Unknown write type: ${type}`);
    }
  }

  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      let response = '';
      
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 5000);
      
      const dataHandler = (data) => {
        response += data.toString();
        
        // Check for command completion (depends on protocol)
        if (response.includes('OK\r') || response.includes('ERROR\r')) {
          clearTimeout(timeout);
          this.port.removeListener('data', dataHandler);
          
          if (response.includes('ERROR')) {
            reject(new Error('Command failed'));
          } else {
            resolve(response);
          }
        }
      };
      
      this.port.on('data', dataHandler);
      
      this.port.write(command, (err) => {
        if (err) {
          clearTimeout(timeout);
          this.port.removeListener('data', dataHandler);
          reject(err);
        }
      });
    });
  }

  handleData(data) {
    this.stats.messagesReceived++;
    
    const message = data.toString();
    this.log(`Received: ${message}`, 'debug');
    
    // Parse unsolicited messages (incoming text, alerts, etc.)
    if (message.includes('+MSG:')) {
      // Incoming text message
      const parsed = this.parseIncomingMessage(message);
      this.emit('data', {
        type: 'message',
        ...parsed,
        timestamp: Date.now()
      });
    } else if (message.includes('+EMERGENCY:')) {
      // Emergency alert
      this.emit('data', {
        type: 'emergency',
        message: message,
        timestamp: Date.now()
      });
    } else if (message.includes('+GPS:')) {
      // GPS location update
      const location = this.parseGPS(message);
      this.emit('data', {
        type: 'location',
        ...location,
        timestamp: Date.now()
      });
    }
  }

  parseIncomingMessage(data) {
    // Parse: +MSG:source,message
    // This is a simplified parser
    const match = data.match(/\+MSG:(\d+),(.+)/);
    if (match) {
      return {
        source: match[1],
        message: match[2].trim()
      };
    }
    return { raw: data };
  }

  parseGPS(data) {
    // Parse GPS data
    // Format depends on DLR protocol
    return {
      latitude: null,
      longitude: null,
      raw: data
    };
  }
}

module.exports = MotorolaDLRInterface;
