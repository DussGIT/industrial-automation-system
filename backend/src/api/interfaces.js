const express = require('express');
const router = express.Router();
const { getDb } = require('../core/database');

// Get all interfaces
router.get('/interfaces', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM interfaces');
    const interfaces = stmt.all();
    
    res.json({ success: true, interfaces });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get supported interface types (must be before /:id route)
router.get('/interfaces/types', (req, res) => {
  res.json({
    success: true,
    types: [
      {
        type: 'radio-ritron-dtx',
        name: 'Ritron DTX Radio',
        category: 'radio',
        description: 'Ritron DTX radio interface'
      },
      {
        type: 'radio-motorola-dlr',
        name: 'Motorola DLR Radio',
        category: 'radio',
        description: 'Motorola DLR digital radio'
      },
      {
        type: 'zigbee',
        name: 'Zigbee',
        category: 'wireless',
        description: 'Zigbee mesh network'
      },
      {
        type: 'camera-ip',
        name: 'IP Camera',
        category: 'camera',
        description: 'Network IP camera'
      },
      {
        type: 'mqtt',
        name: 'MQTT',
        category: 'network',
        description: 'MQTT messaging protocol'
      }
    ]
  });
});

// Get single interface
router.get('/interfaces/:id', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM interfaces WHERE id = ?');
    const interface_config = stmt.get(req.params.id);
    
    if (!interface_config) {
      return res.status(404).json({ success: false, error: 'Interface not found' });
    }
    
    interface_config.config = JSON.parse(interface_config.config);
    res.json({ success: true, interface: interface_config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create/update interface
router.post('/interfaces', (req, res) => {
  try {
    const db = getDb();
    const { id, type, name, config } = req.body;
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO interfaces (id, type, name, config, updated_at)
      VALUES (?, ?, ?, ?, strftime('%s', 'now'))
    `);
    
    stmt.run(id, type, name, JSON.stringify(config));
    
    res.json({ success: true, id });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete interface
router.delete('/interfaces/:id', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM interfaces WHERE id = ?');
    stmt.run(req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { router };
