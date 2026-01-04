const db = require('better-sqlite3')('/data/flows.db');

console.log('\n=== FLOWS TABLE ===');
const flows = db.prepare('SELECT id, name, status, created_at FROM flows').all();
console.log('Total flows:', flows.length);
flows.forEach(f => {
  console.log(`- ${f.name} (${f.id}): ${f.status}`);
});

console.log('\n=== XBEE DEVICES ===');
const devices = db.prepare('SELECT address64, name FROM devices').all();
console.log('Total XBee devices:', devices.length);
devices.forEach(d => {
  console.log(`- ${d.name}: ${d.address64}`);
});

console.log('\n=== SETTINGS ===');
const settings = db.prepare('SELECT key, value FROM settings WHERE key LIKE "%xbee%"').all();
settings.forEach(s => {
  console.log(`${s.key}: ${s.value}`);
});
