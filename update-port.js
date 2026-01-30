const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'flows.db');
const Database = require('./core/database');

async function updatePort() {
    try {
        const db = new Database(dbPath);
        await db.init();
        await db.setSetting('xbee.port', '/dev/ttyUSB0');
        const port = await db.getSetting('xbee.port');
        console.log('Updated XBee port to:', port);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updatePort();
