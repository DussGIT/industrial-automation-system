const express = require('express');
const router = express.Router();
const { getDb } = require('../core/database');

// Get flow execution logs
router.get('/analytics/executions', (req, res) => {
  try {
    const db = getDb();
    const { flowId, limit = 100, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM flow_executions';
    const params = [];
    
    if (flowId) {
      query += ' WHERE flow_id = ?';
      params.push(flowId);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const stmt = db.prepare(query);
    const executions = stmt.all(...params);
    
    res.json({ success: true, executions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get analytics metrics
router.get('/analytics/metrics', (req, res) => {
  try {
    const db = getDb();
    const { metric, start, end } = req.query;
    
    let query = 'SELECT * FROM analytics WHERE 1=1';
    const params = [];
    
    if (metric) {
      query += ' AND metric_name = ?';
      params.push(metric);
    }
    
    if (start) {
      query += ' AND timestamp >= ?';
      params.push(parseInt(start));
    }
    
    if (end) {
      query += ' AND timestamp <= ?';
      params.push(parseInt(end));
    }
    
    query += ' ORDER BY timestamp DESC';
    
    const stmt = db.prepare(query);
    const metrics = stmt.all(...params);
    
    res.json({ success: true, metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record analytics metric
router.post('/analytics/metrics', (req, res) => {
  try {
    const db = getDb();
    const { metric_name, metric_value, tags } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO analytics (metric_name, metric_value, tags)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(metric_name, metric_value, tags ? JSON.stringify(tags) : null);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get system logs
router.get('/analytics/logs', (req, res) => {
  try {
    const db = getDb();
    const { level, service, limit = 100, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM system_logs WHERE 1=1';
    const params = [];
    
    if (level) {
      query += ' AND level = ?';
      params.push(level);
    }
    
    if (service) {
      query += ' AND service = ?';
      params.push(service);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const stmt = db.prepare(query);
    const logs = stmt.all(...params);
    
    res.json(logs);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all system logs
router.post('/analytics/logs/clear', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM system_logs');
    const result = stmt.run();
    
    res.json({ success: true, deleted: result.changes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get flow statistics
router.get('/analytics/flows/stats', (req, res) => {
  try {
    const db = getDb();
    
    // Get execution stats per flow
    const stmt = db.prepare(`
      SELECT 
        flow_id,
        COUNT(*) as total_executions,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
        AVG(duration_ms) as avg_duration_ms,
        MAX(timestamp) as last_execution
      FROM flow_executions
      GROUP BY flow_id
    `);
    
    const stats = stmt.all();
    
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { router };
