const express = require('express');
const router = express.Router();
const { getRadioManager } = require('../core/radio-manager');
const { getBroadcastQueue } = require('../flow-engine/broadcast-queue');
const logger = require('../core/logger');

/**
 * Get radio status - queue, current transmission, stats
 */
router.get('/status', (req, res) => {
  try {
    // Return broadcast queue status instead of radio-manager
    // since we're using broadcast-queue for radio broadcasts
    const broadcastQueue = getBroadcastQueue();
    const queueStatus = broadcastQueue.getStatus();
    
    res.json({
      success: true,
      status: {
        isTransmitting: queueStatus.isProcessing,
        queueLength: queueStatus.queueLength,
        currentTransmission: queueStatus.currentBroadcast ? {
          nodeName: queueStatus.currentBroadcast.nodeName,
          frequency: queueStatus.currentBroadcast.channel,
          elapsed: queueStatus.currentBroadcast.elapsed,
          audioFile: 'TTS Broadcast'
        } : null,
        queue: queueStatus.queue.map(q => ({
          nodeName: q.nodeName,
          frequency: q.channel,
          audioFile: 'TTS Broadcast',
          queuedAt: q.queuedAt
        })),
        estimatedWaitTime: 0,
        stats: {
          totalTransmissions: queueStatus.stats.totalBroadcasts,
          queuedTransmissions: queueStatus.stats.completedBroadcasts,
          failedTransmissions: queueStatus.stats.failedBroadcasts,
          lastTransmission: null
        }
      }
    });
  } catch (error) {
    logger.error(`Failed to get radio status: ${error.message}`, {
      service: 'radio-api',
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Cancel a queued transmission
 */
router.post('/cancel/:transmissionId', (req, res) => {
  try {
    const { transmissionId } = req.params;
    const radioManager = getRadioManager();
    
    const cancelled = radioManager.cancelTransmission(transmissionId);
    
    if (cancelled) {
      res.json({
        success: true,
        message: 'Transmission cancelled'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Transmission not found or already completed'
      });
    }
  } catch (error) {
    logger.error(`Failed to cancel transmission: ${error.message}`, {
      service: 'radio-api',
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Clear entire transmission queue
 */
router.post('/clear-queue', (req, res) => {
  try {
    const radioManager = getRadioManager();
    const count = radioManager.clearQueue();
    
    res.json({
      success: true,
      message: `${count} transmissions cancelled`,
      count
    });
  } catch (error) {
    logger.error(`Failed to clear queue: ${error.message}`, {
      service: 'radio-api',
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get radio statistics
 */
router.get('/stats', (req, res) => {
  try {
    const radioManager = getRadioManager();
    const status = radioManager.getStatus();
    
    res.json({
      success: true,
      stats: status.stats
    });
  } catch (error) {
    logger.error(`Failed to get radio stats: ${error.message}`, {
      service: 'radio-api',
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
