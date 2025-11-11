// NOTE: Using in-memory database for now
// To use SQLite, install Python and build tools, then: npm install better-sqlite3
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

let db = null;
let inMemoryDB = {
  flows: [],
  flowExecutions: [],
  interfaces: [],
  analytics: [],
  systemLogs: []
};

const initialize = () => {
  try {
    // Using in-memory database
    db = {
      prepare: (sql) => ({
        run: (...params) => {
          // Simple in-memory implementation
          logger.debug(`SQL: ${sql}`);
          return { changes: 1 };
        },
        get: (...params) => {
          // Return first matching record
          if (sql.includes('FROM flows')) {
            return inMemoryDB.flows[0];
          }
          return null;
        },
        all: (...params) => {
          // Return all matching records
          if (sql.includes('FROM flows')) {
            return inMemoryDB.flows;
          } else if (sql.includes('FROM flow_executions')) {
            return inMemoryDB.flowExecutions;
          } else if (sql.includes('FROM interfaces')) {
            return inMemoryDB.interfaces;
          } else if (sql.includes('FROM analytics')) {
            return inMemoryDB.analytics;
          } else if (sql.includes('FROM system_logs')) {
            return inMemoryDB.systemLogs;
          }
          return [];
        }
      }),
      exec: (sql) => {
        logger.debug(`EXEC: ${sql}`);
      }
    };
    
    // Create tables (in-memory structure already exists)
    createTables();
    
    logger.info('In-memory database initialized successfully');
    logger.warn('Using in-memory database - data will not persist! Install better-sqlite3 for persistence.');
  } catch (error) {
    logger.error('Database initialization failed:', error);
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
