const BaseNode = require('../base-node');
const { getBroadcastQueue } = require('../../broadcast-queue');

/**
 * Cancel Broadcast Node
 * Cancels all pending broadcasts from a specific source
 */
class CancelBroadcastNode extends BaseNode {
  static type = 'cancel-broadcast';

  constructor(config) {
    super(config);
    
    // Handle nested config structure
    const nodeConfig = config.data?.config || config.config || config;
    
    // Optional: configure source from node config (default: from message payload)
    this.cancelSource = nodeConfig.cancelSource || null;
    
    this.broadcastQueue = getBroadcastQueue();
  }

  /**
   * Replace template variables in text with message data
   */
  replaceTemplateVariables(text, msg) {
    if (!text) return '';
    
    let result = text;
    
    // Replace {{variable}} patterns
    const regex = /\{\{([^}]+)\}\}/g;
    result = result.replace(regex, (match, variable) => {
      const key = variable.trim();
      
      // Support nested properties like {{payload.buttonName}}
      const parts = key.split('.');
      let value = msg;
      
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          return match; // Keep original if not found
        }
      }
      
      return value !== undefined ? String(value) : match;
    });
    
    return result;
  }

  async receive(msg) {
    // Determine source to cancel
    let source;
    
    if (this.cancelSource) {
      // Use configured source (supports template variables)
      source = this.replaceTemplateVariables(this.cancelSource, msg);
    } else {
      // Get source from message payload
      source = msg.payload?.source 
            || msg.payload?.buttonName 
            || msg.payload?.deviceName
            || msg.payload?.cancelSource;
    }
    
    if (!source) {
      this.log('No source specified for cancellation', 'warn');
      this.send(msg); // Pass message along
      return;
    }

    // Cancel all broadcasts from this source
    const cancelled = this.broadcastQueue.cancelBySource(source);
    
    if (cancelled) {
      this.log(`✓ Cancelled all broadcasts from: ${source}`, 'info');
      msg.payload = {
        ...msg.payload,
        action: 'cancel_broadcast',
        source,
        cancelled: true,
        timestamp: Date.now()
      };
    } else {
      this.log(`No active broadcasts from: ${source}`, 'info');
      msg.payload = {
        ...msg.payload,
        action: 'cancel_broadcast',
        source,
        cancelled: false,
        message: 'No active broadcasts',
        timestamp: Date.now()
      };
    }
    
    // Pass message along (could trigger other actions)
    this.send(msg);
  }
}

module.exports = CancelBroadcastNode;
