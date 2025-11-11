const BaseNode = require('../base-node');

/**
 * Zigbee Button Node
 * Triggers flows based on Zigbee button presses
 */
class ZigbeeButtonNode extends BaseNode {
  static type = 'zigbee-button';
  static category = 'input';
  static label = 'Zigbee Button';

  constructor(config) {
    super(config);
    
    // Button configuration
    this.deviceAddr = config.deviceAddr; // IEEE address of button
    this.buttonAction = config.buttonAction || 'any'; // single, double, triple, hold, release, any
    this.interfaceId = config.interfaceId; // Which Zigbee interface to use
    
    this.interface = null;
    this.eventHandler = null;
  }

  async initialize(context) {
    await super.initialize(context);
    
    // Get Zigbee interface from context
    if (this.interfaceId) {
      this.interface = context.getInterface(this.interfaceId);
      
      if (!this.interface) {
        throw new Error(`Zigbee interface ${this.interfaceId} not found`);
      }
      
      // Listen for button events
      this.eventHandler = (data) => this.handleButtonEvent(data);
      this.interface.on('data', this.eventHandler);
      
      this.log(`Listening for button events on ${this.deviceAddr || 'all devices'}`);
    } else {
      throw new Error('No Zigbee interface configured');
    }
  }

  async handleButtonEvent(data) {
    // Filter button events
    if (data.type !== 'button') {
      return;
    }
    
    // Filter by device address if specified
    if (this.deviceAddr && this.deviceAddr !== 'any' && data.ieeeAddr !== this.deviceAddr) {
      return;
    }
    
    // Filter by action if specified
    if (this.buttonAction && this.buttonAction !== 'any' && data.action !== this.buttonAction) {
      return;
    }
    
    this.log(`Button event: ${data.action} from ${data.ieeeAddr}`);
    
    // Prepare message for downstream nodes
    const message = {
      payload: {
        action: data.action,
        device: data.ieeeAddr,
        deviceType: data.deviceType,
        endpoint: data.endpoint,
        cluster: data.cluster,
        command: data.command,
        data: data.payload
      },
      topic: `zigbee/button/${data.ieeeAddr}/${data.action}`,
      timestamp: data.timestamp
    };
    
    // Send to output
    this.send(message);
  }

  async onInput(message) {
    // This node only generates output, doesn't process input
    // But we can use input to manually trigger or configure
    
    if (message.payload?.command === 'configure') {
      // Reconfigure button
      await this.interface.write({
        type: 'configureButton',
        ieeeAddr: this.deviceAddr,
        data: message.payload.options
      });
    } else if (message.payload?.command === 'getDevices') {
      // Get list of available devices
      const devices = await this.interface.read({ command: 'devices' });
      
      this.send({
        payload: devices,
        topic: 'zigbee/devices'
      });
    }
  }

  async cleanup() {
    // Remove event listener
    if (this.interface && this.eventHandler) {
      this.interface.removeListener('data', this.eventHandler);
    }
    
    await super.cleanup();
  }

  static getConfig() {
    return {
      type: 'zigbee-button',
      category: 'input',
      label: 'Zigbee Button',
      color: '#00a0dc',
      icon: 'font-awesome/fa-toggle-on',
      inputs: 0,
      outputs: 1,
      defaults: {
        name: { value: '' },
        interfaceId: { value: '', required: true },
        deviceAddr: { value: 'any' },
        buttonAction: { value: 'any' }
      },
      paletteLabel: 'zigbee button',
      description: 'Triggers on Zigbee button press events'
    };
  }
}

module.exports = ZigbeeButtonNode;
