const logger = require('./logger');
const EventEmitter = require('events');

/**
 * Radio Manager - Handles radio transmission queuing and prevents conflicts
 * Ensures only one radio transmission occurs at a time
 */
class RadioManager extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.isTransmitting = false;
    this.currentTransmission = null;
    this.stats = {
      totalTransmissions: 0,
      queuedTransmissions: 0,
      failedTransmissions: 0,
      lastTransmission: null
    };
  }

  /**
   * Request a radio transmission
   * @param {Object} request - Transmission request
   * @returns {Promise} Resolves when transmission completes
   */
  async requestTransmission(request) {
    const transmissionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const transmission = {
      id: transmissionId,
      nodeId: request.nodeId,
      nodeName: request.nodeName,
      audioFile: request.audioFile,
      config: request.config,
      requestedAt: Date.now(),
      startedAt: null,
      completedAt: null,
      status: 'queued'
    };

    return new Promise((resolve, reject) => {
      transmission.resolve = resolve;
      transmission.reject = reject;

      // Add to queue
      this.queue.push(transmission);
      this.stats.queuedTransmissions++;

      logger.info(`Radio transmission queued: ${transmissionId} (Queue: ${this.queue.length})`, {
        service: 'radio-manager',
        nodeId: request.nodeId,
        audioFile: request.audioFile.name,
        frequency: request.config.frequency
      });

      this.emit('transmission:queued', {
        id: transmissionId,
        queuePosition: this.queue.length,
        estimatedWait: this.estimateWaitTime()
      });

      // Process queue
      this.processQueue();
    });
  }

  /**
   * Process the transmission queue
   */
  async processQueue() {
    // Already transmitting, queue will be processed when current transmission completes
    if (this.isTransmitting) {
      logger.debug('Radio busy, waiting for current transmission to complete', {
        service: 'radio-manager',
        queueLength: this.queue.length
      });
      return;
    }

    // No items in queue
    if (this.queue.length === 0) {
      return;
    }

    // Get next transmission
    const transmission = this.queue.shift();
    this.isTransmitting = true;
    this.currentTransmission = transmission;
    transmission.status = 'transmitting';
    transmission.startedAt = Date.now();

    const waitTime = transmission.startedAt - transmission.requestedAt;

    logger.info(`Starting radio transmission: ${transmission.id}`, {
      service: 'radio-manager',
      nodeId: transmission.nodeId,
      audioFile: transmission.audioFile.name,
      frequency: transmission.config.frequency,
      waitTime: `${waitTime}ms`,
      queueRemaining: this.queue.length
    });

    this.emit('transmission:started', {
      id: transmission.id,
      nodeId: transmission.nodeId,
      frequency: transmission.config.frequency,
      audioFile: transmission.audioFile.name,
      waitTime
    });

    try {
      // Execute the transmission
      const result = await this.executeTransmission(transmission);
      
      transmission.status = 'completed';
      transmission.completedAt = Date.now();
      transmission.result = result;

      this.stats.totalTransmissions++;
      this.stats.lastTransmission = {
        id: transmission.id,
        timestamp: transmission.completedAt,
        frequency: transmission.config.frequency,
        duration: transmission.completedAt - transmission.startedAt
      };

      logger.info(`Radio transmission completed: ${transmission.id}`, {
        service: 'radio-manager',
        duration: `${transmission.completedAt - transmission.startedAt}ms`
      });

      this.emit('transmission:completed', {
        id: transmission.id,
        duration: transmission.completedAt - transmission.startedAt
      });

      transmission.resolve(result);

    } catch (error) {
      transmission.status = 'failed';
      transmission.completedAt = Date.now();
      transmission.error = error.message;

      this.stats.failedTransmissions++;

      logger.error(`Radio transmission failed: ${transmission.id} - ${error.message}`, {
        service: 'radio-manager',
        nodeId: transmission.nodeId,
        error: error.message
      });

      this.emit('transmission:failed', {
        id: transmission.id,
        error: error.message
      });

      transmission.reject(error);

    } finally {
      this.isTransmitting = false;
      this.currentTransmission = null;

      // Process next item in queue
      if (this.queue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  /**
   * Execute a radio transmission
   * @param {Object} transmission - Transmission object
   */
  async executeTransmission(transmission) {
    const { audioFile, config } = transmission;

    // Log transmission details
    logger.info('Radio Broadcast Configuration:', { service: 'radio-manager' });
    logger.info(`  Frequency: ${config.frequency} MHz`, { service: 'radio-manager' });
    logger.info(`  Power: ${config.power}W`, { service: 'radio-manager' });
    logger.info(`  Modulation: ${config.modulation}`, { service: 'radio-manager' });
    logger.info(`  Port: ${config.radioPort}`, { service: 'radio-manager' });
    logger.info(`  Audio: ${audioFile.name} (${audioFile.format})`, { service: 'radio-manager' });
    logger.info(`  Duration: ${audioFile.duration}s`, { service: 'radio-manager' });
    logger.info(`  Repeat: ${config.repeat}x`, { service: 'radio-manager' });

    // Simulate broadcast delay (duration * repeat)
    const totalDuration = audioFile.duration * config.repeat * 1000;
    await new Promise(resolve => setTimeout(resolve, totalDuration));

    // TODO: Replace with actual radio hardware commands:
    // 1. Acquire exclusive lock on radio hardware
    // 2. Open serial connection to radio (e.g., via CAT control)
    // 3. Set frequency, power, modulation
    // 4. Key PTT (Push-To-Talk)
    // 5. Stream audio file to radio audio input
    // 6. Wait for audio to complete
    // 7. Unkey PTT
    // 8. Close connection
    // 9. Release lock

    logger.info('Radio broadcast simulation complete', { service: 'radio-manager' });

    return {
      success: true,
      frequency: config.frequency,
      duration: audioFile.duration * config.repeat,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Estimate wait time for queued transmissions
   */
  estimateWaitTime() {
    let estimatedTime = 0;

    // Add current transmission time if transmitting
    if (this.isTransmitting && this.currentTransmission) {
      const elapsed = Date.now() - this.currentTransmission.startedAt;
      const total = this.currentTransmission.audioFile.duration * 
                    this.currentTransmission.config.repeat * 1000;
      estimatedTime += Math.max(0, total - elapsed);
    }

    // Add queued transmission times
    for (const tx of this.queue) {
      estimatedTime += tx.audioFile.duration * tx.config.repeat * 1000;
    }

    return estimatedTime;
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isTransmitting: this.isTransmitting,
      queueLength: this.queue.length,
      currentTransmission: this.currentTransmission ? {
        id: this.currentTransmission.id,
        nodeId: this.currentTransmission.nodeId,
        nodeName: this.currentTransmission.nodeName,
        frequency: this.currentTransmission.config.frequency,
        audioFile: this.currentTransmission.audioFile.name,
        startedAt: this.currentTransmission.startedAt,
        elapsed: Date.now() - this.currentTransmission.startedAt
      } : null,
      queue: this.queue.map(tx => ({
        id: tx.id,
        nodeId: tx.nodeId,
        nodeName: tx.nodeName,
        frequency: tx.config.frequency,
        audioFile: tx.audioFile.name,
        queuedAt: tx.requestedAt
      })),
      estimatedWaitTime: this.estimateWaitTime(),
      stats: this.stats
    };
  }

  /**
   * Cancel a transmission (if queued)
   */
  cancelTransmission(transmissionId) {
    const index = this.queue.findIndex(tx => tx.id === transmissionId);
    
    if (index !== -1) {
      const transmission = this.queue.splice(index, 1)[0];
      transmission.reject(new Error('Transmission cancelled'));
      
      logger.info(`Radio transmission cancelled: ${transmissionId}`, {
        service: 'radio-manager'
      });

      this.emit('transmission:cancelled', { id: transmissionId });
      return true;
    }

    return false;
  }

  /**
   * Clear all queued transmissions
   */
  clearQueue() {
    const count = this.queue.length;
    
    this.queue.forEach(tx => {
      tx.reject(new Error('Queue cleared'));
    });
    
    this.queue = [];
    
    logger.info(`Radio queue cleared: ${count} transmissions cancelled`, {
      service: 'radio-manager'
    });

    this.emit('queue:cleared', { count });
    
    return count;
  }
}

// Singleton instance
let radioManagerInstance = null;

module.exports = {
  /**
   * Get the radio manager instance
   */
  getRadioManager: () => {
    if (!radioManagerInstance) {
      radioManagerInstance = new RadioManager();
      logger.info('Radio Manager initialized', { service: 'radio-manager' });
    }
    return radioManagerInstance;
  },

  RadioManager
};
