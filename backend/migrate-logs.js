const Database = require('better-sqlite3');
const db = new Database('./data/flows.db');

console.log('Adding service column to system_logs table...');

try {
  db.prepare('ALTER TABLE system_logs ADD COLUMN service TEXT').run();
  console.log('Column added successfully!');
} catch (error) {
  if (error.message.includes('duplicate column name')) {
    console.log('Column already exists');
  } else {
    console.error('Error:', error.message);
  }
}

// Verify the change
const schema = db.prepare('PRAGMA table_info(system_logs)').all();
console.log('\nUpdated schema:');
console.log(schema.map(col => `${col.name} (${col.type})`).join(', '));

db.close();
