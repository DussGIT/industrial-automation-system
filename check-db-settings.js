const {getDb} = require('./src/core/database');
const db = getDb();

console.log('\nChecking XBee port setting in database...\n');

const xbeeSetting = db.prepare('SELECT * FROM settings WHERE key = ?').get('xbeePort');
console.log('xbeePort setting:', xbeeSetting);

const allSettings = db.prepare('SELECT * FROM settings').all();
console.log('\nAll settings:');
allSettings.forEach(s => console.log(`  ${s.key}: ${s.value}`));
