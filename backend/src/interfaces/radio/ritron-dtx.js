const BaseInterface = require('../base-interface');
const { SerialPort } = require('serialport');

/**
 * Ritron DTX Radio Interface
 * Provides control and communication with Ritron DTX radio systems
 */
class RitronDTXInterface extends BaseInterface {
  static type = 'radio-ritron-dtx';

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
    this.channel = this.config.channel || 1;
    this.pttActive = false;
  }

  async connect() {
    try {
      this.log(`Connecting to Ritron DTX on ${this.serialConfig.path}`);
      
      this.port = new SerialPort(this.serialConfig);
      
      return new Promise((resolve, reject) => {
        this.port.on('open', () => {
          this.setStatus('connected');
          this.stats.connected = Date.now();
          this.log('Connected to Ritron DTX');
          
          // Set up data handler
          this.port.on('data', (data) => this.handleData(data));
          this.port.on('error', (err) => this.handleError(err));
          
          // Initialize radio
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
          this.log('Disconnected from Ritron DTX');
          resolve();
        });
      });
    }
  }

  async initialize() {
    // Send initialization commands to radio
    await this.setChannel(this.channel);
    this.log(`Initialized on channel ${this.channel}`);
  }

  async setChannel(channel) {
    // Implementation depends on Ritron DTX protocol
    // This is a placeholder
    const command = `CH${channel}\r\n`;
    return this.sendCommand(command);
  }

  async setPTT(active) {
    // Toggle Push-to-Talk
    this.pttActive = active;
    const command = active ? 'PTT1\r\n' : 'PTT0\r\n';
    await this.sendCommand(command);
    this.log(`PTT ${active ? 'activated' : 'deactivated'}`);
  }

  async checkClearChannel() {
    // Check if channel is clear (no carrier detected)
    // Send carrier detect query command
    const command = 'RSSI?\r\n'; // Request signal strength
    
    try {
      const response = await this.sendCommand(command);
      
      // Parse RSSI response
      // Typical format: RSSI=-95 (in dBm)
      const match = response.match(/RSSI=(-?\d+)/);
      
      if (match) {
        const rssi = parseInt(match[1]);
        const threshold = this.config.clearChannelThreshold || -90; // dBm
        
        // Channel is clear if RSSI is below threshold (weaker signal = less interference)
        const isClear = rssi < threshold;
        
        this.log(`Channel check: RSSI=${rssi}dBm, Clear=${isClear}`, 'debug');
        
        return {
          clear: isClear,
          rssi: rssi,
          threshold: threshold
        };
      }
      
      // If we can't parse, assume channel is busy for safety
      return { clear: false, rssi: null, error: 'Unable to parse RSSI' };
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
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.log('Timeout waiting for clear channel', 'warn');
    return false;
  }

  async transmit(data, options = {}) {
    try {
      // Check for clear channel if requested
      if (options.checkClear !== false) { // Default to checking
        const isClear = await this.waitForClearChannel(options.clearTimeout || 5000);
        
        if (!isClear && !options.forceTransmit) {
          throw new Error('Channel busy - transmission aborted');
        }
      }
      
      await this.setPTT(true);
      // Send audio data or text message
      // Implementation depends on specific protocol
      await this.write({ data });
      await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay
      await this.setPTT(false);
      
      this.stats.messagesSent++;
      return { success: true };
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async read(params) {
    // Read current status or received messages
    // This would typically be event-driven via handleData()
    return {
      channel: this.channel,
      pttActive: this.pttActive,
      status: this.status
    };
  }

  async write(params) {
    if (!this.port || !this.port.isOpen) {
      throw new Error('Port not open');
    }

    const { data } = params;
    return this.sendCommand(data);
  }

  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      this.port.write(command, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  handleData(data) {
    this.stats.messagesReceived++;
    
    // Parse received data
    const message = data.toString();
    this.log(`Received: ${message}`, 'debug');
    
    // Emit data event for flow nodes to consume
    this.emit('data', {
      raw: data,
      message: message,
      timestamp: Date.now()
    });
  }

  async cleanup() {
    if (this.pttActive) {
      await this.setPTT(false);
    }
    await super.cleanup();
  }
}

module.exports = RitronDTXInterface;
