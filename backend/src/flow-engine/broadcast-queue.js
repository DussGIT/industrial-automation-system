/**
 * Global Broadcast Queue Manager
 * Ensures only one radio broadcast happens at a time across all flows
 */

class BroadcastQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Add a broadcast job to the queue
   * @param {Function} broadcastFn - Async function that performs the broadcast
   * @returns {Promise} - Resolves when the broadcast completes
   */
  async enqueue(broadcastFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ broadcastFn, resolve, reject });
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
    console.log(`[BroadcastQueue] Processing queue (${this.queue.length} jobs waiting)`);

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      console.log(`[BroadcastQueue] Processing job (${this.queue.length} remaining)`);
      try {
        await job.broadcastFn();
        console.log(`[BroadcastQueue] Job completed successfully`);
        job.resolve();
      } catch (error) {
        console.error(`[BroadcastQueue] Job failed:`, error);
        job.reject(error);
      }
    }

    console.log(`[BroadcastQueue] Queue empty, processing complete`);
    this.isProcessing = false;
  }

  /**
   * Get current queue length
   */
  getQueueLength() {
    return this.queue.length;
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
