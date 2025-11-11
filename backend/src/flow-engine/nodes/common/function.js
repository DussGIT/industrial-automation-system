const BaseNode = require('../base-node');

/**
 * Function Node - Execute JavaScript code to transform messages
 */
class FunctionNode extends BaseNode {
  static type = 'function';

  constructor(config) {
    super(config);
    this.code = this.config.code || 'return msg;';
    this.func = null;
  }

  async start() {
    // Compile the function
    try {
      // Create function with msg, node, and context parameters
      this.func = new Function('msg', 'node', 'context', this.code);
      this.log('Function compiled successfully');
    } catch (error) {
      this.error(new Error(`Failed to compile function: ${error.message}`));
    }
  }

  async receive(data) {
    if (!this.func) {
      this.error(new Error('Function not compiled'));
      return;
    }

    try {
      // Create a safe context
      const context = {
        get: (key) => this.context ? this.context[key] : undefined,
        set: (key, value) => {
          if (!this.context) this.context = {};
          this.context[key] = value;
        }
      };

      // Execute the function
      const result = this.func(data, {
        id: this.id,
        name: this.name,
        log: (msg) => this.log(msg),
        warn: (msg) => this.log(msg, 'warn'),
        error: (msg) => this.log(msg, 'error')
      }, context);

      // Send the result
      if (result !== undefined && result !== null) {
        this.send(result, data);
      }
    } catch (error) {
      this.error(new Error(`Function execution error: ${error.message}`));
    }
  }
}

module.exports = FunctionNode;
