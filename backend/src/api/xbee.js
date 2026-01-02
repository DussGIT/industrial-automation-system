const express = require('express');
const router = express.Router();
const { getXBeeManager } = require('../core/xbee-manager');
const logger = require('../core/logger');

/**
 * Get XBee connection status
 */
router.get('/xbee/status', (req, res) => {
  try {
    const xbeeManager = getXBeeManager();
    
    res.json({
      connected: xbeeManager.isReady(),
      port: xbeeManager.port || 'Not configured',
      baudRate: xbeeManager.baudRate || 9600,
      devices: Array.from(xbeeManager.devices.values())
    });
  } catch (error) {
    logger.error('Error getting XBee status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get discovered XBee devices
 */
router.get('/xbee/devices', (req, res) => {
  try {
    const xbeeManager = getXBeeManager();
    const devices = Array.from(xbeeManager.devices.values());
    
    res.json({ devices });
  } catch (error) {
    logger.error('Error getting XBee devices:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Trigger network discovery
 */
router.post('/xbee/discover', async (req, res) => {
  try {
    const xbeeManager = getXBeeManager();
    
    if (!xbeeManager.isReady()) {
      return res.status(400).json({ error: 'XBee not connected' });
    }
    
    await xbeeManager.discoverNetwork();
    
    res.json({ success: true, message: 'Network discovery started' });
  } catch (error) {
    logger.error('Error starting XBee discovery:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send data to XBee device
 */
router.post('/xbee/send', async (req, res) => {
  try {
    const { address, data } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Device address required' });
    }
    
    if (!data) {
      return res.status(400).json({ error: 'Data required' });
    }
    
    const xbeeManager = getXBeeManager();
    
    if (!xbeeManager.isReady()) {
      return res.status(400).json({ error: 'XBee not connected' });
    }
    
    const frameId = await xbeeManager.sendData(address, data);
    
    res.json({ 
      success: true, 
      frameId,
      message: 'Data sent successfully' 
    });
  } catch (error) {
    logger.error('Error sending XBee data:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
