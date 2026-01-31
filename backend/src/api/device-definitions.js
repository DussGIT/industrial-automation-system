const express = require('express');
const router = express.Router();
const database = require('../core/database');
const logger = require('../core/logger');
const crypto = require('crypto');

/**
 * Device Definitions API
 * Manages device type definitions for flexible device integration
 */

/**
 * Get all device definitions
 */
router.get('/device-definitions', (req, res) => {
  try {
    const db = database.getDb();
    const { device_type, manufacturer } = req.query;
    
    let query = 'SELECT * FROM device_definitions';
    const params = [];
    const conditions = [];
    
    if (device_type) {
      conditions.push('device_type = ?');
      params.push(device_type);
    }
    
    if (manufacturer) {
      conditions.push('manufacturer = ?');
      params.push(manufacturer);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY manufacturer, model';
    
    const stmt = db.prepare(query);
    const definitions = stmt.all(...params).map(row => ({
      ...row,
      definition: JSON.parse(row.definition)
    }));
    
    res.json({
      success: true,
      definitions,
      total: definitions.length
    });
  } catch (error) {
    logger.error('Error fetching device definitions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get a specific device definition
 */
router.get('/device-definitions/:id', (req, res) => {
  try {
    const db = database.getDb();
    const stmt = db.prepare('SELECT * FROM device_definitions WHERE id = ?');
    const definition = stmt.get(req.params.id);
    
    if (!definition) {
      return res.status(404).json({ success: false, error: 'Definition not found' });
    }
    
    res.json({
      success: true,
      definition: {
        ...definition,
        definition: JSON.parse(definition.definition)
      }
    });
  } catch (error) {
    logger.error('Error fetching device definition:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create or update a device definition
 */
router.post('/device-definitions', (req, res) => {
  try {
    const db = database.getDb();
    const { id, deviceType, manufacturer, model, version, definition, source } = req.body;
    
    // Validate required fields
    if (!deviceType || !manufacturer || !model || !version || !definition) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: deviceType, manufacturer, model, version, definition'
      });
    }
    
    // Generate ID if not provided
    const definitionId = id || `${manufacturer.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, '-')}-v${version}`;
    
    const now = Math.floor(Date.now() / 1000);
    
    // Check if definition already exists
    const existing = db.prepare('SELECT id FROM device_definitions WHERE id = ?').get(definitionId);
    
    if (existing) {
      // Update existing definition
      const stmt = db.prepare(`
        UPDATE device_definitions 
        SET device_type = ?, manufacturer = ?, model = ?, version = ?, 
            definition = ?, source = ?, updated_at = ?
        WHERE id = ?
      `);
      
      stmt.run(
        deviceType,
        manufacturer,
        model,
        version,
        JSON.stringify(definition),
        source || 'local',
        now,
        definitionId
      );
      
      logger.info('Device definition updated', { id: definitionId });
    } else {
      // Insert new definition
      const stmt = db.prepare(`
        INSERT INTO device_definitions 
        (id, device_type, manufacturer, model, version, definition, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        definitionId,
        deviceType,
        manufacturer,
        model,
        version,
        JSON.stringify(definition),
        source || 'local',
        now,
        now
      );
      
      logger.info('Device definition created', { id: definitionId });
    }
    
    res.json({
      success: true,
      id: definitionId,
      message: existing ? 'Definition updated' : 'Definition created'
    });
  } catch (error) {
    logger.error('Error saving device definition:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a device definition
 */
router.delete('/device-definitions/:id', (req, res) => {
  try {
    const db = database.getDb();
    
    // Check if any devices are using this definition
    const instanceCount = db.prepare(
      'SELECT COUNT(*) as count FROM device_instances WHERE definition_id = ?'
    ).get(req.params.id);
    
    if (instanceCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete definition: ${instanceCount.count} device(s) still using it`
      });
    }
    
    const stmt = db.prepare('DELETE FROM device_definitions WHERE id = ?');
    const result = stmt.run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Definition not found' });
    }
    
    logger.info('Device definition deleted', { id: req.params.id });
    
    res.json({ success: true, message: 'Definition deleted' });
  } catch (error) {
    logger.error('Error deleting device definition:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all device instances
 */
router.get('/device-instances', (req, res) => {
  try {
    const db = database.getDb();
    const { device_type, status } = req.query;
    
    let query = `
      SELECT di.*, dd.manufacturer, dd.model, dd.version
      FROM device_instances di
      LEFT JOIN device_definitions dd ON di.definition_id = dd.id
    `;
    const params = [];
    const conditions = [];
    
    if (device_type) {
      conditions.push('di.device_type = ?');
      params.push(device_type);
    }
    
    if (status) {
      conditions.push('di.status = ?');
      params.push(status);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY di.name';
    
    const stmt = db.prepare(query);
    const instances = stmt.all(...params).map(row => ({
      ...row,
      config: row.config ? JSON.parse(row.config) : null
    }));
    
    res.json({
      success: true,
      instances,
      total: instances.length,
      byType: {
        camera: instances.filter(i => i.device_type === 'camera').length,
        sensor: instances.filter(i => i.device_type === 'sensor').length
      }
    });
  } catch (error) {
    logger.error('Error fetching device instances:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Register a new device instance
 */
router.post('/device-instances', (req, res) => {
  try {
    const db = database.getDb();
    const { name, deviceType, definitionId, ipAddress, config } = req.body;
    
    // Validate required fields
    if (!name || !deviceType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, deviceType'
      });
    }
    
    // Generate unique ID
    const id = crypto.randomBytes(16).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    
    const stmt = db.prepare(`
      INSERT INTO device_instances 
      (id, definition_id, name, device_type, ip_address, config, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      definitionId || null,
      name,
      deviceType,
      ipAddress || null,
      config ? JSON.stringify(config) : null,
      'offline',
      now,
      now
    );
    
    logger.info('Device instance registered', { id, name, deviceType });
    
    res.json({
      success: true,
      id,
      message: 'Device registered successfully'
    });
  } catch (error) {
    logger.error('Error registering device instance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update device instance
 */
router.put('/device-instances/:id', (req, res) => {
  try {
    const db = database.getDb();
    const { name, ipAddress, config, status } = req.body;
    const now = Math.floor(Date.now() / 1000);
    
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    
    if (ipAddress !== undefined) {
      updates.push('ip_address = ?');
      params.push(ipAddress);
    }
    
    if (config !== undefined) {
      updates.push('config = ?');
      params.push(JSON.stringify(config));
    }
    
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    
    updates.push('updated_at = ?');
    params.push(now);
    
    params.push(req.params.id);
    
    const stmt = db.prepare(`
      UPDATE device_instances 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    
    const result = stmt.run(...params);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    logger.info('Device instance updated', { id: req.params.id });
    
    res.json({ success: true, message: 'Device updated' });
  } catch (error) {
    logger.error('Error updating device instance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete device instance
 */
router.delete('/device-instances/:id', (req, res) => {
  try {
    const db = database.getDb();
    
    const stmt = db.prepare('DELETE FROM device_instances WHERE id = ?');
    const result = stmt.run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    logger.info('Device instance deleted', { id: req.params.id });
    
    res.json({ success: true, message: 'Device deleted' });
  } catch (error) {
    logger.error('Error deleting device instance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
