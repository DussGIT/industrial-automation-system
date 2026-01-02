const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

let db = null;

const initialize = () => {
  try {
    // Use SQLite database - /data is mounted from host
    const dbPath = '/data/flows.db';
    const dataDir = path.dirname(dbPath);
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL'); // Better performance
    
    logger.info('SQLite database initialized successfully');
    createTables();
    return db;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
};

const createTables = () => {
  // Flows table
  db.exec(`
    CREATE TABLE IF NOT EXISTS flows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      config TEXT NOT NULL,
      status TEXT DEFAULT 'stopped',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      version INTEGER DEFAULT 1
    )
  `);
  
  // Flow execution logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS flow_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flow_id TEXT NOT NULL,
      node_id TEXT,
      status TEXT NOT NULL,
      input_data TEXT,
      output_data TEXT,
      error TEXT,
      duration_ms INTEGER,
      timestamp INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (flow_id) REFERENCES flows(id)
    )
  `);
  
  // Create index for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_flow_executions_flow_id 
    ON flow_executions(flow_id)
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_flow_executions_timestamp 
    ON flow_executions(timestamp)
  `);
  
  // Interface configurations
  db.exec(`
    CREATE TABLE IF NOT EXISTS interfaces (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      config TEXT NOT NULL,
      status TEXT DEFAULT 'inactive',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  
  // Analytics data
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      tags TEXT,
      timestamp INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_analytics_metric_timestamp 
    ON analytics(metric_name, timestamp)
  `);
  
  // System logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT,
      timestamp INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp 
    ON system_logs(timestamp)
  `);
  
  // Audio files library
  db.exec(`
    CREATE TABLE IF NOT EXISTS audio_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      format TEXT NOT NULL,
      size INTEGER NOT NULL,
      duration REAL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audio_files_created_at 
    ON audio_files(created_at)
  `);
  
  // Devices table (unified storage for all device types)
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      address TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT,
      capabilities TEXT,
      metadata TEXT,
      status TEXT DEFAULT 'disconnected',
      last_seen INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_devices_type 
    ON devices(type)
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_devices_status 
    ON devices(status)
  `);
};

const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

const close = () => {
  if (db) {
    db.close();
    logger.info('Database closed');
  }
};

module.exports = {
  initialize,
  getDb,
  close
};
