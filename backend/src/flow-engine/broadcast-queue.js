/**
 * Global Broadcast Queue Manager
 * Ensures only one radio broadcast happens at a time across all flows
 */

const logger = require('../core/logger');

class BroadcastQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.currentBroadcast = null;
    this.stats = {
      totalBroadcasts: 0,
      completedBroadcasts: 0,
      failedBroadcasts: 0
    };
  }

  /**
   * Add a broadcast job to the queue
   * @param {Function} broadcastFn - Async function that performs the broadcast
   * @param {Object} metadata - Optional metadata about the broadcast
   * @returns {Promise} - Resolves when the broadcast completes
   */
  async enqueue(broadcastFn, metadata = {}) {
    return new Promise((resolve, reject) => {
      const job = {
        broadcastFn,
        resolve,
        reject,
        metadata: {
          nodeName: metadata.nodeName || 'Unknown',
          channel: metadata.channel || 0,
          queuedAt: Date.now(),
          ...metadata
        }
      };
      
      this.queue.push(job);
      logger.info(`Broadcast enqueued (${this.queue.length} in queue)`, {
        service: 'broadcast-queue',
        nodeName: job.metadata.nodeName,
        channel: job.metadata.channel
      });
      this.processQueue();
    });
  }

  /**
   * Process jobs from the queue sequentially
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    logger.info(`Processing broadcast queue (${this.queue.length} jobs waiting)`, {
      service: 'broadcast-queue'
    });

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      this.currentBroadcast = {
        nodeName: job.metadata.nodeName,
        channel: job.metadata.channel,
        startedAt: Date.now()
      };
      
      logger.info(`Processing broadcast job (${this.queue.length} remaining)`, {
        service: 'broadcast-queue',
        nodeName: this.currentBroadcast.nodeName
      });
      
      try {
        await job.broadcastFn();
        this.stats.totalBroadcasts++;
        this.stats.completedBroadcasts++;
        logger.info(`Broadcast job completed successfully`, {
          service: 'broadcast-queue',
          nodeName: this.currentBroadcast.nodeName
        });
        job.resolve();
      } catch (error) {
        this.stats.failedBroadcasts++;
        logger.error(`Broadcast job failed: ${error.message}`, {
          service: 'broadcast-queue',
          error: error.message,
          nodeName: this.currentBroadcast.nodeName
        });
        job.reject(error);
      }
      
      this.currentBroadcast = null;
    }

    logger.info(`Broadcast queue empty, processing complete`, {
      service: 'broadcast-queue'
    });
    this.isProcessing = false;
  }

  /**
   * Get current queue length
   */
  getQueueLength() {
    return this.queue.length;
  }

  /**
   * Get broadcast queue status
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.queue.length,
      currentBroadcast: this.currentBroadcast ? {
        nodeName: this.currentBroadcast.nodeName,
        channel: this.currentBroadcast.channel,
        elapsed: Date.now() - this.currentBroadcast.startedAt
      } : null,
      queue: this.queue.map(job => ({
        nodeName: job.metadata.nodeName,
        channel: job.metadata.channel,
        queuedAt: job.metadata.queuedAt
      })),
      stats: this.stats
    };
  }
}

// Singleton instance
let queueInstance = null;

function getBroadcastQueue() {
  if (!queueInstance) {
    queueInstance = new BroadcastQueue();
  }
  return queueInstance;
}

module.exports = { getBroadcastQueue };
