const express = require('express');
const router = express.Router();
const database = require('../core/database');
const logger = require('../core/logger');

/**
 * Initialize settings table
 */
function initializeSettingsTable() {
  try {
    const db = database.getDb();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default settings if they don't exist
  const defaults = [
    {
      key: 'xbee.port',
      value: 'COM8',
      type: 'string',
      category: 'xbee',
      label: 'XBee COM Port',
      description: 'Serial port for XBee coordinator'
    },
    {
      key: 'xbee.baudRate',
      value: '9600',
      type: 'number',
      category: 'xbee',
      label: 'XBee Baud Rate',
      description: 'Baud rate for XBee serial communication'
    },
    {
      key: 'mqtt.broker',
      value: 'mqtt://localhost:1883',
      type: 'string',
      category: 'mqtt',
      label: 'MQTT Broker URL',
      description: 'URL of the MQTT broker'
    },
    {
      key: 'system.siteId',
      value: 'site-001',
      type: 'string',
      category: 'system',
      label: 'Site ID',
      description: 'Unique identifier for this site'
    },
    {
      key: 'system.siteName',
      value: 'Main Site',
      type: 'string',
      category: 'system',
      label: 'Site Name',
      description: 'Display name for this site'
    }
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, type, category, label, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const setting of defaults) {
    insert.run(
      setting.key,
      setting.value,
      setting.type,
      setting.category,
      setting.label,
      setting.description
    );
  }
  } catch (error) {
    // Database not initialized yet, will be called later
    logger.warn('Settings table initialization deferred - database not ready');
  }
}

/**
 * GET /api/settings
 * Get all settings
 */
router.get('/', (req, res) => {
  try {
    const db = database.getDb();
    const settings = db.prepare('SELECT * FROM settings ORDER BY category, key').all();
    
    // Group by category
    const grouped = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {});

    res.json({ settings: grouped });
  } catch (error) {
    logger.error('Error fetching settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/settings/:key
 * Get a specific setting by key
 */
router.get('/:key', (req, res) => {
  try {
    const db = database.getDb();
    const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(req.params.key);
    
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json(setting);
  } catch (error) {
    logger.error('Error fetching setting:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/settings/:key
 * Update a setting
 */
router.put('/:key', (req, res) => {
  try {
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const db = database.getDb();
    const update = db.prepare(`
      UPDATE settings 
      SET value = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE key = ?
    `);

    const result = update.run(String(value), req.params.key);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(req.params.key);

    logger.info(`Setting updated: ${req.params.key} = ${value}`);
    res.json(setting);
  } catch (error) {
    logger.error('Error updating setting:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/settings/restart-required
 * Check if restart is required after settings change
 */
router.post('/restart-required', (req, res) => {
  const { keys } = req.body;
  
  // Settings that require restart
  const restartRequired = ['xbee.port', 'xbee.baudRate', 'mqtt.broker'];
  
  const needsRestart = keys.some(key => restartRequired.includes(key));
  
  res.json({ restartRequired: needsRestart });
});

// Export router and initialization function
module.exports = router;
module.exports.initializeSettingsTable = initializeSettingsTable;
