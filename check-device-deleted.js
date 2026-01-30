const Database = require('better-sqlite3');
const db = new Database('/data/flows.db', { readonly: true });

const address = '0013a20041b258ef';

const deviceNames = db.prepare('SELECT * FROM device_names WHERE address = ?').all(address);
const devices = db.prepare('SELECT * FROM devices WHERE address = ?').all(address);

console.log('device_names table:', deviceNames.length > 0 ? deviceNames : 'EMPTY');
console.log('devices table:', devices.length > 0 ? devices : 'EMPTY');

db.close();
