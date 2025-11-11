const BaseNode = require('../base-node');

/**
 * Debug Node - Outputs messages to console and system logs
 */
class DebugNode extends BaseNode {
  static type = 'debug';

  constructor(config) {
    super(config);
    this.output = this.config.output || 'console'; // console, log, both
    this.complete = this.config.complete || false; // show complete message or just payload
  }

  async receive(data) {
    const output = this.complete ? data : (data.payload !== undefined ? data.payload : data);
    const message = typeof output === 'object' ? JSON.stringify(output, null, 2) : String(output);
    
    if (this.output === 'console' || this.output === 'both') {
      console.log(`[DEBUG ${this.name}]:`, message);
    }
    
    if (this.output === 'log' || this.output === 'both') {
      this.log(message);
    }
    
    // Emit to UI for real-time monitoring
    if (this.io) {
      this.io.emit('debug:message', {
        nodeId: this.id,
        nodeName: this.name,
        message: output,
        timestamp: Date.now()
      });
    }
    
    // Pass through
    this.send(data);
  }
}

module.exports = DebugNode;
