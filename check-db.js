const db = require('better-sqlite3')('/data/flows.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));
const settings = db.prepare("SELECT * FROM settings WHERE key LIKE '%xbee%'").all();
console.log('XBee settings:', settings);
