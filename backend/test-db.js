const Database = require('better-sqlite3');
const db = new Database('./data/flows.db');

console.log('=== Tables ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables);

console.log('\n=== System Logs (first 5) ===');
try {
  const logs = db.prepare('SELECT * FROM system_logs LIMIT 5').all();
  console.log(logs);
} catch (error) {
  console.log('Error:', error.message);
}

db.close();
