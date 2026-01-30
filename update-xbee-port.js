const db = require('better-sqlite3')('/data/flows.db');
db.prepare('INSERT OR REPLACE INTO settings (key, value, type, category, label, description) VALUES (?, ?, ?, ?, ?, ?)').run('xbee.port', '/dev/ttyUSB0', 'string', 'hardware', 'XBee Port', 'XBee serial port');
console.log('XBee port updated to /dev/ttyUSB0');
