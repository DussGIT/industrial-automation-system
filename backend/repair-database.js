const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || '/app/data/flows.db';
const backupPath = dbPath + '.backup';
const newDbPath = dbPath + '.new';

console.log('Database Repair Tool');
console.log('===================');
console.log('Database path:', dbPath);

// Backup the corrupted database
try {
  console.log('\n1. Creating backup...');
  fs.copyFileSync(dbPath, backupPath);
  console.log('   Backup created:', backupPath);
} catch (err) {
  console.error('   Failed to create backup:', err.message);
  process.exit(1);
}

// Try to extract data from corrupted database
let flows = [];
let settings = [];

try {
  console.log('\n2. Attempting to extract data from corrupted database...');
  const db = new Database(dbPath, { readonly: true });
  
  try {
    flows = db.prepare('SELECT * FROM flows').all();
    console.log(`   Extracted ${flows.length} flows`);
  } catch (err) {
    console.log('   Could not extract flows:', err.message);
  }
  
  try {
    settings = db.prepare('SELECT * FROM settings').all();
    console.log(`   Extracted ${settings.length} settings`);
  } catch (err) {
    console.log('   Could not extract settings:', err.message);
  }
  
  db.close();
} catch (err) {
  console.log('   Database is severely corrupted, cannot open:', err.message);
}

// Create new database
console.log('\n3. Creating new database...');
if (fs.existsSync(newDbPath)) {
  fs.unlinkSync(newDbPath);
}

const newDb = new Database(newDbPath);

// Create schema
console.log('   Creating schema...');
newDb.exec(`
  CREATE TABLE IF NOT EXISTS flows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    nodes TEXT NOT NULL,
    edges TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    level TEXT NOT NULL,
    category TEXT,
    message TEXT NOT NULL,
    metadata TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT,
    config TEXT,
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
  CREATE INDEX IF NOT EXISTS idx_logs_category ON logs(category);
`);

// Restore data
console.log('\n4. Restoring data to new database...');
if (flows.length > 0) {
  const insertFlow = newDb.prepare(`
    INSERT INTO flows (id, name, description, nodes, edges, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const flow of flows) {
    try {
      insertFlow.run(
        flow.id,
        flow.name,
        flow.description || '',
        flow.nodes || '[]',
        flow.edges || '[]',
        flow.enabled !== undefined ? flow.enabled : 1,
        flow.created_at || new Date().toISOString(),
        flow.updated_at || new Date().toISOString()
      );
      console.log(`   Restored flow: ${flow.name} (nodes: ${flow.nodes ? 'yes' : 'empty'}, edges: ${flow.edges ? 'yes' : 'empty'})`);
    } catch (err) {
      console.log(`   Failed to restore flow ${flow.name}:`, err.message);
    }
  }
}

if (settings.length > 0) {
  const insertSetting = newDb.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
  `);
  
  for (const setting of settings) {
    try {
      insertSetting.run(setting.key, setting.value, setting.updated_at);
      console.log(`   Restored setting: ${setting.key}`);
    } catch (err) {
      console.log(`   Failed to restore setting ${setting.key}:`, err.message);
    }
  }
}

newDb.close();

// Replace old database with new one
console.log('\n5. Replacing corrupted database with repaired version...');
fs.unlinkSync(dbPath);
fs.renameSync(newDbPath, dbPath);
console.log('   Database replaced successfully');

console.log('\n✓ Database repair complete!');
console.log(`  Backup of corrupted database: ${backupPath}`);
console.log(`  Restored ${flows.length} flows and ${settings.length} settings`);
console.log('\nPlease restart the backend container.');
