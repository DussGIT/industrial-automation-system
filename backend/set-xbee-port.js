const Database = require('better-sqlite3');
const db = new Database('/app/data/flows.db');
db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('/dev/ttyUSB5', 'xbee.port');
console.log('✓ XBee port set to /dev/ttyUSB5');
db.close();
