const BaseInterface = require('../base-interface');
const { SerialPort } = require('serialport');

/**
 * Zigbee Interface
 * Provides control and communication with Zigbee devices including buttons, sensors, and switches
 * Supports various Zigbee coordinators (ConBee II, CC2531, etc.)
 */
class ZigbeeInterface extends BaseInterface {
  static type = 'wireless-zigbee';

  constructor(config) {
    super(config);
    this.port = null;
    this.serialConfig = {
      path: this.config.port || '/dev/ttyACM0',
      baudRate: this.config.baudRate || 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none'
    };
    
    // Device registry
    this.devices = new Map();
    
    // Button device types
    this.buttonDevices = {
      'IKEA_TRADFRI': {
        manufacturer: 'IKEA',
        model: 'TRADFRI',
        buttons: ['toggle', 'brightness_up', 'brightness_down', 'left', 'right']
      },
      'PHILIPS_HUE_TAP': {
        manufacturer: 'Philips',
        model: 'Hue Tap',
        buttons: ['button_1', 'button_2', 'button_3', 'button_4']
      },
      'XIAOMI_BUTTON': {
        manufacturer: 'Xiaomi',
        model: 'Aqara Button',
        buttons: ['single', 'double', 'triple', 'hold', 'release']
      },
      'TUYA_BUTTON': {
        manufacturer: 'Tuya',
        model: 'Smart Button',
        buttons: ['single', 'double', 'hold']
      },
      'SONOFF_BUTTON': {
        manufacturer: 'SONOFF',
        model: 'SNZB-01',
        buttons: ['single', 'double', 'long']
      }
    };
  }

  async connect() {
    try {
      this.log(`Connecting to Zigbee coordinator on ${this.serialConfig.path}`);
      
      this.port = new SerialPort(this.serialConfig);
      
      return new Promise((resolve, reject) => {
        this.port.on('open', () => {
          this.setStatus('connected');
          this.stats.connected = Date.now();
          this.log('Connected to Zigbee coordinator');
          
          // Set up data handler
          this.port.on('data', (data) => this.handleData(data));
          this.port.on('error', (err) => this.handleError(err));
          
          // Initialize coordinator
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
          this.log('Disconnected from Zigbee coordinator');
          resolve();
        });
      });
    }
  }

  async initialize() {
    // Initialize Zigbee coordinator
    await this.sendCommand({ cmd: 'version' });
    await this.sendCommand({ cmd: 'networkState' });
    
    // Start device discovery if configured
    if (this.config.autoDiscover !== false) {
      await this.startPairing(60); // 60 second pairing window
    }
    
    this.log('Zigbee coordinator initialized');
  }

  async startPairing(duration = 60) {
    // Open network for new devices to join
    this.log(`Starting pairing mode for ${duration} seconds`);
    
    await this.sendCommand({
      cmd: 'permitJoin',
      duration: duration
    });
    
    return { success: true, duration };
  }

  async stopPairing() {
    // Close network
    this.log('Stopping pairing mode');
    
    await this.sendCommand({
      cmd: 'permitJoin',
      duration: 0
    });
    
    return { success: true };
  }

  async getDevices() {
    // Get list of paired devices
    const response = await this.sendCommand({ cmd: 'getDevices' });
    
    // Update device registry
    if (response.devices) {
      response.devices.forEach(device => {
        this.devices.set(device.ieeeAddr, device);
      });
    }
    
    return Array.from(this.devices.values());
  }

  async getDevice(ieeeAddr) {
    // Get specific device info
    return this.devices.get(ieeeAddr);
  }

  async removeDevice(ieeeAddr) {
    // Remove device from network
    this.log(`Removing device ${ieeeAddr}`);
    
    await this.sendCommand({
      cmd: 'removeDevice',
      ieeeAddr: ieeeAddr
    });
    
    this.devices.delete(ieeeAddr);
    
    return { success: true };
  }

  async bindButton(ieeeAddr, endpoint = 1) {
    // Bind button to coordinator for direct reporting
    this.log(`Binding button ${ieeeAddr} endpoint ${endpoint}`);
    
    await this.sendCommand({
      cmd: 'bind',
      ieeeAddr: ieeeAddr,
      endpoint: endpoint,
      cluster: 'genOnOff' // Standard On/Off cluster for buttons
    });
    
    // Also bind level control for dimmer buttons
    await this.sendCommand({
      cmd: 'bind',
      ieeeAddr: ieeeAddr,
      endpoint: endpoint,
      cluster: 'genLevelCtrl'
    });
    
    return { success: true };
  }

  async configureButton(ieeeAddr, options = {}) {
    // Configure button reporting
    const device = this.devices.get(ieeeAddr);
    
    if (!device) {
      throw new Error(`Device ${ieeeAddr} not found`);
    }
    
    this.log(`Configuring button ${ieeeAddr}`);
    
    // Bind button
    await this.bindButton(ieeeAddr, options.endpoint || 1);
    
    // Configure reporting intervals
    await this.sendCommand({
      cmd: 'configureReporting',
      ieeeAddr: ieeeAddr,
      endpoint: options.endpoint || 1,
      cluster: 'genOnOff',
      attribute: 'onOff',
      minInterval: options.minInterval || 1,
      maxInterval: options.maxInterval || 300,
      reportableChange: 1
    });
    
    return { success: true };
  }

  async handleButtonPress(data) {
    // Parse button press event
    const { ieeeAddr, endpoint, cluster, command, data: payload } = data;
    
    const device = this.devices.get(ieeeAddr);
    const deviceType = device ? this.identifyButtonType(device) : 'UNKNOWN';
    
    // Map Zigbee command to button action
    let action = 'unknown';
    
    switch (command) {
      case 'on':
      case 'toggle':
        action = 'single';
        break;
      case 'off':
        action = 'release';
        break;
      case 'moveWithOnOff':
      case 'move':
        action = 'hold';
        break;
      case 'stop':
      case 'stopWithOnOff':
        action = 'release';
        break;
      case 'step':
      case 'stepWithOnOff':
        action = payload?.stepMode === 0 ? 'brightness_up' : 'brightness_down';
        break;
      case 'recall':
        action = `scene_${payload?.sceneId || 0}`;
        break;
      default:
        action = command;
    }
    
    // Detect multi-click patterns
    const clickCount = this.detectMultiClick(ieeeAddr, action);
    if (clickCount > 1) {
      action = clickCount === 2 ? 'double' : clickCount === 3 ? 'triple' : 'multi';
    }
    
    const event = {
      type: 'button',
      deviceType: deviceType,
      ieeeAddr: ieeeAddr,
      endpoint: endpoint,
      action: action,
      cluster: cluster,
      command: command,
      payload: payload,
      timestamp: Date.now(),
      device: device
    };
    
    this.log(`Button press: ${ieeeAddr} - ${action}`, 'info');
    
    // Emit event for flow nodes
    this.emit('data', event);
    
    return event;
  }

  detectMultiClick(ieeeAddr, action) {
    // Simple multi-click detection
    const now = Date.now();
    const clickWindow = 500; // ms
    
    if (!this.clickHistory) {
      this.clickHistory = new Map();
    }
    
    const history = this.clickHistory.get(ieeeAddr) || [];
    
    // Remove old clicks outside the window
    const recentClicks = history.filter(t => now - t < clickWindow);
    
    if (action === 'single') {
      recentClicks.push(now);
      this.clickHistory.set(ieeeAddr, recentClicks);
      return recentClicks.length;
    }
    
    return 1;
  }

  identifyButtonType(device) {
    // Identify button type from device info
    const manufacturer = device.manufacturerName?.toLowerCase() || '';
    const model = device.modelID?.toLowerCase() || '';
    
    if (manufacturer.includes('ikea') || model.includes('tradfri')) {
      return 'IKEA_TRADFRI';
    } else if (manufacturer.includes('philips') || model.includes('hue')) {
      return 'PHILIPS_HUE_TAP';
    } else if (manufacturer.includes('lumi') || manufacturer.includes('xiaomi')) {
      return 'XIAOMI_BUTTON';
    } else if (manufacturer.includes('tuya') || manufacturer.includes('_tz')) {
      return 'TUYA_BUTTON';
    } else if (manufacturer.includes('sonoff') || model.includes('snzb')) {
      return 'SONOFF_BUTTON';
    }
    
    return 'GENERIC_BUTTON';
  }

  async read(params) {
    const { command, ieeeAddr } = params;
    
    switch (command) {
      case 'devices':
        return this.getDevices();
      case 'device':
        return this.getDevice(ieeeAddr);
      case 'networkState':
        return this.sendCommand({ cmd: 'networkState' });
      default:
        throw new Error(`Unknown read command: ${command}`);
    }
  }

  async write(params) {
    if (!this.port || !this.port.isOpen) {
      throw new Error('Port not open');
    }

    const { type, ieeeAddr, data } = params;
    
    switch (type) {
      case 'pair':
        return this.startPairing(data?.duration || 60);
      case 'unpair':
        return this.stopPairing();
      case 'remove':
        return this.removeDevice(ieeeAddr);
      case 'configureButton':
        return this.configureButton(ieeeAddr, data);
      case 'command':
        return this.sendCommand(data);
      default:
        throw new Error(`Unknown write type: ${type}`);
    }
  }

  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      // Format command based on coordinator type
      // This example uses a JSON-based protocol
      const payload = JSON.stringify(command) + '\n';
      
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 10000);
      
      let response = '';
      
      const dataHandler = (data) => {
        response += data.toString();
        
        // Check for complete JSON response
        try {
          const parsed = JSON.parse(response);
          clearTimeout(timeout);
          this.port.removeListener('data', dataHandler);
          resolve(parsed);
        } catch (e) {
          // Not complete yet, keep accumulating
        }
      };
      
      this.port.on('data', dataHandler);
      
      this.port.write(payload, (err) => {
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
    
    try {
      const message = data.toString();
      this.log(`Received: ${message}`, 'debug');
      
      // Parse JSON message
      const parsed = JSON.parse(message);
      
      // Handle different message types
      if (parsed.type === 'deviceJoined') {
        this.handleDeviceJoined(parsed);
      } else if (parsed.type === 'deviceLeft') {
        this.handleDeviceLeft(parsed);
      } else if (parsed.type === 'deviceAnnounce') {
        this.handleDeviceAnnounce(parsed);
      } else if (parsed.type === 'attributeReport' || parsed.type === 'commandReceived') {
        // Check if it's a button event
        if (this.isButtonEvent(parsed)) {
          this.handleButtonPress(parsed);
        } else {
          // Other sensor events
          this.emit('data', {
            type: 'sensor',
            ...parsed,
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      this.log(`Error parsing Zigbee data: ${error.message}`, 'error');
    }
  }

  isButtonEvent(data) {
    // Determine if this is a button event based on cluster/command
    const buttonClusters = ['genOnOff', 'genLevelCtrl', 'genScenes'];
    const buttonCommands = ['on', 'off', 'toggle', 'move', 'step', 'stop', 'recall'];
    
    return buttonClusters.includes(data.cluster) || 
           buttonCommands.includes(data.command);
  }

  handleDeviceJoined(data) {
    this.log(`Device joined: ${data.ieeeAddr}`, 'info');
    
    // Add to device registry
    this.devices.set(data.ieeeAddr, data.device);
    
    this.emit('data', {
      type: 'deviceJoined',
      ...data,
      timestamp: Date.now()
    });
  }

  handleDeviceLeft(data) {
    this.log(`Device left: ${data.ieeeAddr}`, 'info');
    
    // Remove from registry
    this.devices.delete(data.ieeeAddr);
    
    this.emit('data', {
      type: 'deviceLeft',
      ...data,
      timestamp: Date.now()
    });
  }

  handleDeviceAnnounce(data) {
    this.log(`Device announce: ${data.ieeeAddr}`, 'debug');
    
    this.emit('data', {
      type: 'deviceAnnounce',
      ...data,
      timestamp: Date.now()
    });
  }

  async cleanup() {
    // Stop pairing mode
    if (this.status === 'connected') {
      await this.stopPairing();
    }
    
    await super.cleanup();
  }
}

module.exports = ZigbeeInterface;
