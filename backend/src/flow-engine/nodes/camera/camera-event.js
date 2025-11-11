const BaseNode = require('../base-node');

/**
 * Camera Event Node
 * Triggers flows based on IP camera events (motion, dwelling, line crossing, etc.)
 */
class CameraEventNode extends BaseNode {
  static type = 'camera-event';
  static category = 'input';
  static label = 'Camera Event';

  constructor(config) {
    super(config);
    
    // Camera configuration
    this.interfaceId = config.interfaceId; // Which camera interface to use
    this.eventType = config.eventType || 'any'; // motion, dwelling, lineCrossing, intrusion, etc.
    this.cameraName = config.cameraName || 'any'; // Specific camera or 'any'
    this.minConfidence = config.minConfidence || 0; // Minimum confidence threshold (0-100)
    
    this.interface = null;
    this.eventHandler = null;
  }

  async initialize(context) {
    await super.initialize(context);
    
    // Get camera interface from context
    if (this.interfaceId) {
      this.interface = context.getInterface(this.interfaceId);
      
      if (!this.interface) {
        throw new Error(`Camera interface ${this.interfaceId} not found`);
      }
      
      // Listen for camera events
      this.eventHandler = (data) => this.handleCameraEvent(data);
      this.interface.on('data', this.eventHandler);
      
      this.log(`Listening for ${this.eventType} events from ${this.cameraName || 'all cameras'}`);
    } else {
      throw new Error('No camera interface configured');
    }
  }

  async handleCameraEvent(data) {
    // Filter camera events
    if (data.type !== 'camera') {
      return;
    }
    
    // Filter by event type if specified
    if (this.eventType && this.eventType !== 'any' && data.eventType !== this.eventType) {
      return;
    }
    
    // Filter by camera name if specified
    if (this.cameraName && this.cameraName !== 'any' && data.camera.name !== this.cameraName) {
      return;
    }
    
    // Filter by confidence threshold
    if (data.confidence < this.minConfidence) {
      this.log(`Event confidence too low: ${data.confidence}% < ${this.minConfidence}%`, 'debug');
      return;
    }
    
    this.log(`Camera event: ${data.eventType} from ${data.camera.name} (${data.confidence}%)`);
    
    // Prepare message for downstream nodes
    const message = {
      payload: {
        eventType: data.eventType,
        camera: data.camera,
        confidence: data.confidence,
        region: data.region,
        metadata: data.metadata
      },
      topic: `camera/${data.camera.name}/${data.eventType}`,
      timestamp: data.timestamp
    };
    
    // Send to output
    this.send(message);
  }

  async onInput(message) {
    // Allow manual triggering or configuration
    if (message.payload?.command === 'getSnapshot') {
      // Request snapshot from camera
      const snapshot = await this.interface.read({ command: 'snapshot' });
      
      this.send({
        payload: snapshot,
        topic: 'camera/snapshot'
      });
    } else if (message.payload?.command === 'configure') {
      // Update sensitivity settings
      await this.interface.write({
        type: 'configure',
        data: message.payload.settings
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
      type: 'camera-event',
      category: 'input',
      label: 'Camera Event',
      color: '#4285F4',
      icon: 'font-awesome/fa-video-camera',
      inputs: 0,
      outputs: 1,
      defaults: {
        name: { value: '' },
        interfaceId: { value: '', required: true },
        eventType: { value: 'any' },
        cameraName: { value: 'any' },
        minConfidence: { value: 70 }
      },
      paletteLabel: 'camera event',
      description: 'Triggers on IP camera events (motion, dwelling, line crossing, intrusion, etc.)'
    };
  }
}

module.exports = CameraEventNode;
