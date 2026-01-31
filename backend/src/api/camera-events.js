const express = require('express');
const router = express.Router();
const database = require('../core/database');
const logger = require('../core/logger');
const crypto = require('crypto');
const mqttClient = require('../core/mqtt');

/**
 * Camera Events API
 * Handles incoming camera events, unknown event mapping, and event history
 */

/**
 * Receive camera event from device (webhook endpoint)
 * This is what the camera POSTs to
 */
router.post('/events/camera/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  const rawPayload = req.body;
  
  try {
    const db = database.getDb();
    
    // Get device instance
    const device = db.prepare('SELECT * FROM device_instances WHERE id = ?').get(deviceId);
    
    if (!device) {
      logger.warn('Event received from unknown device', { deviceId });
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    // Update device last_seen
    db.prepare('UPDATE device_instances SET last_seen = ?, status = ? WHERE id = ?')
      .run(Math.floor(Date.now() / 1000), 'online', deviceId);
    
    // Get device definition if available
    let definition = null;
    if (device.definition_id) {
      const defRow = db.prepare('SELECT * FROM device_definitions WHERE id = ?').get(device.definition_id);
      if (defRow) {
        definition = JSON.parse(defRow.definition);
      }
    }
    
    // Parse event using definition or detect as unknown
    let parsedEvent = null;
    let isUnknown = false;
    
    if (definition && definition.eventMappings) {
      parsedEvent = parseEventWithDefinition(rawPayload, definition);
    }
    
    if (!parsedEvent) {
      // Unknown event - log it for later mapping
      isUnknown = true;
      parsedEvent = await handleUnknownEvent(deviceId, rawPayload);
    }
    
    // Store event in camera_events table (local retention)
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days
    
    const eventId = db.prepare(`
      INSERT INTO camera_events 
      (device_id, event_type, confidence, region, metadata, timestamp, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      deviceId,
      parsedEvent.eventType || 'unknown',
      parsedEvent.confidence || null,
      parsedEvent.region || null,
      JSON.stringify({ raw: rawPayload, parsed: parsedEvent }),
      Math.floor(Date.now() / 1000),
      expiresAt
    ).lastInsertRowid;
    
    if (!isUnknown) {
      // Publish to MQTT for flow engine consumption
      const mqttTopic = `camera/${device.name}/${parsedEvent.eventType}`;
      const mqttPayload = {
        deviceId,
        deviceName: device.name,
        eventType: parsedEvent.eventType,
        confidence: parsedEvent.confidence,
        region: parsedEvent.region,
        timestamp: Date.now(),
        eventId
      };
      
      try {
        await mqttClient.publish(mqttTopic, mqttPayload);
        logger.info('Camera event published to MQTT', { topic: mqttTopic, deviceName: device.name });
      } catch (mqttError) {
        logger.warn('Failed to publish to MQTT', { error: mqttError.message });
      }
      
      logger.info('Camera event processed', {
        deviceId,
        deviceName: device.name,
        eventType: parsedEvent.eventType,
        eventId
      });
    } else {
      logger.info('Unknown camera event logged', {
        deviceId,
        deviceName: device.name,
        eventId
      });
    }
    
    // Respond to camera
    res.json({ success: true, eventId, unknown: isUnknown });
    
  } catch (error) {
    logger.error('Error processing camera event', { deviceId, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Parse event using device definition
 */
function parseEventWithDefinition(rawPayload, definition) {
  try {
    // Determine event type from payload
    let eventType = null;
    let mappingConfig = null;
    
    // Check each mapping in definition
    for (const [signature, mapping] of Object.entries(definition.eventMappings || {})) {
      // Try to match signature (could be ONVIF topic, Hikvision event code, etc.)
      if (rawPayload.topic === signature || 
          rawPayload.eventType === signature ||
          rawPayload.Event === signature) {
        eventType = mapping.eventType;
        mappingConfig = mapping;
        break;
      }
    }
    
    if (!eventType) {
      return null; // Unknown event
    }
    
    // Extract fields using JSONPath-like syntax
    const parsedEvent = {
      eventType
    };
    
    if (mappingConfig.fields) {
      for (const [fieldName, fieldPath] of Object.entries(mappingConfig.fields)) {
        if (typeof fieldPath === 'string' && fieldPath.startsWith('$.')) {
          // Simple JSONPath extraction (e.g., "$.data.confidence")
          parsedEvent[fieldName] = extractValue(rawPayload, fieldPath);
        } else {
          // Static value
          parsedEvent[fieldName] = fieldPath;
        }
      }
    }
    
    return parsedEvent;
  } catch (error) {
    logger.error('Error parsing event with definition', { error: error.message });
    return null;
  }
}

/**
 * Simple JSONPath-like value extraction
 */
function extractValue(obj, path) {
  const parts = path.replace(/^\$\./, '').split('.');
  let value = obj;
  
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return null;
    }
  }
  
  return value;
}

/**
 * Handle unknown event (log for later mapping)
 */
async function handleUnknownEvent(deviceId, rawPayload) {
  const db = database.getDb();
  
  // Create signature for deduplication
  const signature = createEventSignature(rawPayload);
  
  // Check if we've seen this event before
  const existing = db.prepare(
    'SELECT * FROM unknown_events WHERE device_id = ? AND event_signature = ?'
  ).get(deviceId, signature);
  
  if (existing) {
    // Update occurrence count and last_seen
    db.prepare(`
      UPDATE unknown_events 
      SET occurrence_count = occurrence_count + 1, last_seen = ?
      WHERE id = ?
    `).run(Math.floor(Date.now() / 1000), existing.id);
  } else {
    // Insert new unknown event
    db.prepare(`
      INSERT INTO unknown_events 
      (device_id, event_signature, raw_payload, first_seen, last_seen, occurrence_count, status)
      VALUES (?, ?, ?, ?, ?, 1, 'pending')
    `).run(
      deviceId,
      signature,
      JSON.stringify(rawPayload),
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    );
  }
  
  return {
    eventType: 'unknown',
    signature,
    raw: rawPayload
  };
}

/**
 * Create a signature for event deduplication
 */
function createEventSignature(payload) {
  // Create hash based on event structure (not timestamp or transient data)
  const structure = {
    topic: payload.topic,
    eventType: payload.eventType || payload.Event,
    keys: Object.keys(payload).sort()
  };
  
  return crypto.createHash('md5')
    .update(JSON.stringify(structure))
    .digest('hex')
    .substring(0, 16);
}

/**
 * Get unknown events
 */
router.get('/events/unknown', (req, res) => {
  try {
    const db = database.getDb();
    const { status, device_id } = req.query;
    
    let query = `
      SELECT ue.*, di.name as device_name, di.device_type
      FROM unknown_events ue
      LEFT JOIN device_instances di ON ue.device_id = di.id
    `;
    const params = [];
    const conditions = [];
    
    if (status) {
      conditions.push('ue.status = ?');
      params.push(status);
    }
    
    if (device_id) {
      conditions.push('ue.device_id = ?');
      params.push(device_id);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY ue.last_seen DESC LIMIT 100';
    
    const stmt = db.prepare(query);
    const events = stmt.all(...params).map(row => ({
      ...row,
      raw_payload: JSON.parse(row.raw_payload)
    }));
    
    res.json({ success: true, events, total: events.length });
  } catch (error) {
    logger.error('Error fetching unknown events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Define mapping for unknown event
 */
router.post('/events/unknown/:id/define', (req, res) => {
  try {
    const db = database.getDb();
    const { eventType, fieldMappings } = req.body;
    
    if (!eventType) {
      return res.status(400).json({ success: false, error: 'eventType is required' });
    }
    
    // Get unknown event
    const unknownEvent = db.prepare('SELECT * FROM unknown_events WHERE id = ?').get(req.params.id);
    
    if (!unknownEvent) {
      return res.status(404).json({ success: false, error: 'Unknown event not found' });
    }
    
    // Get device and its definition
    const device = db.prepare('SELECT * FROM device_instances WHERE id = ?').get(unknownEvent.device_id);
    
    if (!device || !device.definition_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Device has no definition to update' 
      });
    }
    
    // Update device definition with new mapping
    const defRow = db.prepare('SELECT * FROM device_definitions WHERE id = ?').get(device.definition_id);
    const definition = JSON.parse(defRow.definition);
    
    if (!definition.eventMappings) {
      definition.eventMappings = {};
    }
    
    const rawPayload = JSON.parse(unknownEvent.raw_payload);
    const signature = rawPayload.topic || rawPayload.eventType || rawPayload.Event;
    
    definition.eventMappings[signature] = {
      eventType,
      fields: fieldMappings || {}
    };
    
    // Save updated definition
    db.prepare('UPDATE device_definitions SET definition = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(definition), Math.floor(Date.now() / 1000), device.definition_id);
    
    // Mark unknown event as mapped
    db.prepare('UPDATE unknown_events SET status = ? WHERE id = ?')
      .run('mapped', req.params.id);
    
    logger.info('Unknown event mapped', { 
      id: req.params.id, 
      eventType, 
      definitionId: device.definition_id 
    });
    
    res.json({ success: true, message: 'Event mapping created' });
  } catch (error) {
    logger.error('Error defining event mapping:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Ignore unknown event
 */
router.post('/events/unknown/:id/ignore', (req, res) => {
  try {
    const db = database.getDb();
    const { notes } = req.body;
    
    const stmt = db.prepare('UPDATE unknown_events SET status = ?, notes = ? WHERE id = ?');
    const result = stmt.run('ignored', notes || null, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Unknown event not found' });
    }
    
    logger.info('Unknown event ignored', { id: req.params.id });
    
    res.json({ success: true, message: 'Event ignored' });
  } catch (error) {
    logger.error('Error ignoring event:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get camera event history
 */
router.get('/events/history', (req, res) => {
  try {
    const db = database.getDb();
    const { device_id, event_type, start, end, limit = 100 } = req.query;
    
    let query = `
      SELECT ce.*, di.name as device_name
      FROM camera_events ce
      LEFT JOIN device_instances di ON ce.device_id = di.id
    `;
    const params = [];
    const conditions = [];
    
    if (device_id) {
      conditions.push('ce.device_id = ?');
      params.push(device_id);
    }
    
    if (event_type) {
      conditions.push('ce.event_type = ?');
      params.push(event_type);
    }
    
    if (start) {
      conditions.push('ce.timestamp >= ?');
      params.push(parseInt(start));
    }
    
    if (end) {
      conditions.push('ce.timestamp <= ?');
      params.push(parseInt(end));
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY ce.timestamp DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const stmt = db.prepare(query);
    const events = stmt.all(...params).map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      processed_by_flows: row.processed_by_flows ? JSON.parse(row.processed_by_flows) : null
    }));
    
    res.json({ success: true, events, total: events.length });
  } catch (error) {
    logger.error('Error fetching event history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Cleanup expired events (called by scheduler)
 */
router.post('/events/cleanup', (req, res) => {
  try {
    const db = database.getDb();
    const now = Math.floor(Date.now() / 1000);
    
    const stmt = db.prepare('DELETE FROM camera_events WHERE expires_at < ?');
    const result = stmt.run(now);
    
    logger.info('Cleaned up expired events', { deleted: result.changes });
    
    res.json({ success: true, deleted: result.changes });
  } catch (error) {
    logger.error('Error cleaning up events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
