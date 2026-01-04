const db = require('better-sqlite3')('/app/data/flows.db');
const result = db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('/dev/ttyUSB5', 'xbee.port');
console.log('Updated XBee port:', result.changes, 'rows affected');
const check = db.prepare('SELECT value FROM settings WHERE key = ?').get('xbee.port');
console.log('New XBee port setting:', check ? check.value : 'NOT FOUND');
