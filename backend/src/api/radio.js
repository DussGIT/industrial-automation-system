const express = require('express');
const router = express.Router();
const { getRadioManager } = require('../core/radio-manager');
const logger = require('../core/logger');

/**
 * Get radio status - queue, current transmission, stats
 */
router.get('/status', (req, res) => {
  try {
    const radioManager = getRadioManager();
    const status = radioManager.getStatus();
    
    res.json({
      success: true,
      status
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
