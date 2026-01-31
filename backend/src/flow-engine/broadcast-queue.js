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
    this.activeBroadcasts = new Map(); // source → cancelToken
    this.stats = {
      totalBroadcasts: 0,
      completedBroadcasts: 0,
      failedBroadcasts: 0,
      cancelledBroadcasts: 0
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
      const source = metadata.source || 'unknown';
      
      // Get or create cancel token for this source
      // If there's an existing cancelled token, remove it and create a fresh one
      const existingToken = this.activeBroadcasts.get(source);
      if (!existingToken || existingToken.cancelled) {
        this.activeBroadcasts.set(source, { cancelled: false });
      }
      const cancelToken = this.activeBroadcasts.get(source);
      
      const job = {
        broadcastFn,
        resolve,
        reject,
        cancelToken,
        metadata: {
          nodeName: metadata.nodeName || 'Unknown',
          channel: metadata.channel || 0,
          source,
          queuedAt: Date.now(),
          ...metadata
        }
      };
      
      this.queue.push(job);
      logger.info(`Broadcast enqueued (${this.queue.length} in queue)`, {
        service: 'broadcast-queue',
        nodeName: job.metadata.nodeName,
        source,
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
      
      // Check if this broadcast was cancelled
      if (job.cancelToken && job.cancelToken.cancelled) {
        logger.info(`Skipping cancelled broadcast from ${job.metadata.source}`, {
          service: 'broadcast-queue',
          source: job.metadata.source
        });
        this.stats.cancelledBroadcasts++;
        job.resolve(); // Resolve (not reject) - cancellation is not an error
        continue;
      }
      
      this.currentBroadcast = {
        nodeName: job.metadata.nodeName,
        source: job.metadata.source,
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
   * Cancel all broadcasts from a specific source
   * @param {string} source - The source identifier to cancel
   * @returns {boolean} - True if broadcasts were cancelled
   */
  cancelBySource(source) {
    const cancelToken = this.activeBroadcasts.get(source);
    if (cancelToken) {
      cancelToken.cancelled = true;
      logger.info(`Cancelled all broadcasts from: ${source}`, {
        service: 'broadcast-queue',
        source
      });
      return true;
    }
    logger.info(`No active broadcasts from: ${source}`, {
      service: 'broadcast-queue',
      source
    });
    return false;
  }

  /**
   * Get list of active broadcast sources
   */
  getActiveSources() {
    return Array.from(this.activeBroadcasts.keys()).filter(
      source => !this.activeBroadcasts.get(source).cancelled
    );
  }

  /**
   * Get broadcast queue status
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.queue.length,
      activeSources: this.getActiveSources(),
      currentBroadcast: this.currentBroadcast ? {
        nodeName: this.currentBroadcast.nodeName,
        source: this.currentBroadcast.source,
        channel: this.currentBroadcast.channel,
        elapsed: Date.now() - this.currentBroadcast.startedAt
      } : null,
      queue: this.queue.map(job => ({
        nodeName: job.metadata.nodeName,
        source: job.metadata.source,
        channel: job.metadata.channel,
        queuedAt: job.metadata.queuedAt,
        cancelled: job.cancelToken?.cancelled || false
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
