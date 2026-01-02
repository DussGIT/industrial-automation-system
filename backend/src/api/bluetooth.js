const express = require('express');
const router = express.Router();
const { getBluetoothManager } = require('../core/bluetooth-manager');
const logger = require('../core/logger');

/**
 * Get Bluetooth status
 */
router.get('/bluetooth/status', (req, res) => {
  try {
    const bluetoothManager = getBluetoothManager();
    const status = bluetoothManager.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting Bluetooth status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all Bluetooth devices
 */
router.get('/bluetooth/devices', (req, res) => {
  try {
    const bluetoothManager = getBluetoothManager();
    const devices = bluetoothManager.getAllDevices();
    res.json({ devices, total: devices.length });
  } catch (error) {
    logger.error('Error getting Bluetooth devices:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Register a new Bluetooth device (from frontend)
 */
router.post('/bluetooth/devices', (req, res) => {
  try {
    const { address, name, services, capabilities } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Device address is required' });
    }

    const bluetoothManager = getBluetoothManager();
    const device = bluetoothManager.registerDevice({ address, name, services, capabilities });
    
    res.json({ success: true, device });
  } catch (error) {
    logger.error('Error registering Bluetooth device:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update device connection status
 */
router.put('/bluetooth/devices/:address/connection', (req, res) => {
  try {
    const { address } = req.params;
    const { connected } = req.body;
    
    if (typeof connected !== 'boolean') {
      return res.status(400).json({ error: 'Connected status (boolean) is required' });
    }

    const bluetoothManager = getBluetoothManager();
    bluetoothManager.setDeviceConnected(address, connected);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating device connection:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Record data received from device
 */
router.post('/bluetooth/devices/:address/data', (req, res) => {
  try {
    const { address } = req.params;
    const { serviceUuid, characteristicUuid, data } = req.body;
    
    if (!serviceUuid || !characteristicUuid || !data) {
      return res.status(400).json({ error: 'serviceUuid, characteristicUuid, and data are required' });
    }

    const bluetoothManager = getBluetoothManager();
    bluetoothManager.recordData(address, serviceUuid, characteristicUuid, data);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error recording Bluetooth data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Remove a Bluetooth device
 */
router.delete('/bluetooth/devices/:address', (req, res) => {
  try {
    const { address } = req.params;
    
    const bluetoothManager = getBluetoothManager();
    const removed = bluetoothManager.removeDevice(address);
    
    if (removed) {
      res.json({ success: true, message: 'Device removed' });
    } else {
      res.status(404).json({ error: 'Device not found' });
    }
  } catch (error) {
    logger.error('Error removing Bluetooth device:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
