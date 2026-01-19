const express = require('express');
const router = express.Router();
const { getXBeeManager } = require('../core/xbee-manager');
const { getBluetoothManager } = require('../core/bluetooth-manager');
const database = require('../core/database');
const logger = require('../core/logger');

// Flag to track if table has been initialized
let tableInitialized = false;

// Initialize device_names table
function initializeDeviceNamesTable() {
  if (tableInitialized) return;
  
  try {
    const db = database.getDb();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS device_names (
        address TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (address, type)
      )
    `).run();
    tableInitialized = true;
    logger.info('Device names table initialized');
  } catch (error) {
    logger.error('Failed to initialize device_names table:', error);
  }
}

/**
 * Get all devices from all sources (XBee, Zigbee, Cameras, etc.)
 */
router.get('/devices', async (req, res) => {
  try {
    logger.info('GET /api/devices request received');
    
    // Ensure table is initialized
    initializeDeviceNamesTable();
    
    const allDevices = [];
    const db = database.getDb();
    
    // Get XBee devices
    try {
      const xbeeManager = getXBeeManager();
      const xbeeDevices = xbeeManager.getAllDevices();
      logger.info(`Found ${xbeeDevices.length} XBee devices`);
      
      xbeeDevices.forEach(device => {
        // Check if device has a custom name in database
        const customName = db.prepare('SELECT name FROM device_names WHERE address = ? AND type = ?')
          .get(device.address64, 'xbee');
        
        allDevices.push({
          id: device.address64,
          address: device.address64,
          name: customName?.name || device.name || device.nodeIdentifier || `XBee-${device.address64.slice(-8)}`,
          type: 'xbee',
          status: 'online',
          lastSeen: device.lastSeen,
          metadata: {
            address16: device.address16,
            deviceType: device.deviceType,
            rssi: device.rssi
          }
        });
      });
    } catch (error) {
      logger.warn('Failed to fetch XBee devices:', error);
    }
    
    // Get Bluetooth devices
    try {
      const bluetoothManager = getBluetoothManager();
      const bluetoothDevices = bluetoothManager.getAllDevices();
      logger.info(`Found ${bluetoothDevices.length} Bluetooth devices`);
      
      bluetoothDevices.forEach(device => {
        // Check if device has a custom name in database
        const customName = db.prepare('SELECT name FROM device_names WHERE address = ? AND type = ?')
          .get(device.address, 'bluetooth');
        
        allDevices.push({
          id: device.address,
          address: device.address,
          name: customName?.name || device.name || `BT-${device.address.slice(-8)}`,
          type: 'bluetooth',
          status: device.connected ? 'online' : 'offline',
          lastSeen: device.lastSeen,
          metadata: {
            services: device.services,
            connectable: device.connectable
          }
        });
      });
    } catch (error) {
      logger.warn('Failed to fetch Bluetooth devices:', error);
    }
    
    // TODO: Add Zigbee devices when Zigbee2MQTT is configured
    // TODO: Add Camera devices when implemented
    // TODO: Add other device types
    
    res.json({ 
      devices: allDevices,
      total: allDevices.length,
      byType: {
        xbee: allDevices.filter(d => d.type === 'xbee').length,
        bluetooth: allDevices.filter(d => d.type === 'bluetooth').length,
        zigbee: allDevices.filter(d => d.type === 'zigbee').length,
        camera: allDevices.filter(d => d.type === 'camera').length
      }
    });
  } catch (error) {
    logger.error('Error fetching all devices:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update device name
 */
router.put('/devices/:type/:address/name', async (req, res) => {
  try {
    // Ensure table is initialized
    initializeDeviceNamesTable();
    
    const { type, address } = req.params;
    const { name } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const db = database.getDb();
    
    // Insert or update device name
    db.prepare(`
      INSERT INTO device_names (address, type, name, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(address, type) DO UPDATE SET
        name = excluded.name,
        updated_at = CURRENT_TIMESTAMP
    `).run(address, type, name);
    
    logger.info('Device name updated', { type, address, name });
    
    // Notify XBee manager to reload device name if it's an XBee device
    if (type === 'xbee') {
      try {
        const xbeeManager = getXBeeManager();
        if (xbeeManager) {
          xbeeManager.updateDeviceName(address, name);
        }
      } catch (error) {
        logger.warn('Failed to update XBee manager device name:', error);
      }
    }
    
    res.json({ 
      success: true,
      device: { address, type, name }
    });
  } catch (error) {
    logger.error('Error updating device name:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete device (from specific system)
 */
router.delete('/devices/:type/:address', async (req, res) => {
  try {
    // Ensure table is initialized
    initializeDeviceNamesTable();
    
    const { type, address } = req.params;
    
    // Handle different device types
    switch (type) {
      case 'xbee':
        // Remove XBee device from both tables and memory
        const db = database.getDb();
        db.prepare('DELETE FROM device_names WHERE address = ? AND type = ?')
          .run(address, type);
        db.prepare('DELETE FROM devices WHERE address = ? AND type = ?')
          .run(address, type);
        
        // Remove from XBee manager memory
        try {
          const xbeeManager = getXBeeManager();
          if (xbeeManager) {
            xbeeManager.removeDevice(address);
          }
        } catch (error) {
          logger.warn('Failed to remove device from XBee manager:', error);
        }
        
        return res.json({ 
          success: true, 
          message: 'XBee device removed. It will reappear when it sends data again.' 
        });
      
      case 'zigbee':
        // TODO: Implement Zigbee device removal via Zigbee2MQTT
        return res.status(501).json({ error: 'Zigbee device removal not yet implemented' });
      
      case 'camera':
        // TODO: Implement camera removal
        return res.status(501).json({ error: 'Camera removal not yet implemented' });
      
      default:
        return res.status(400).json({ error: 'Unknown device type' });
    }
  } catch (error) {
    logger.error('Error removing device:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
