const Database = require('better-sqlite3');
const db = new Database('./data/flows.db');

const testLogs = [
  { level: 'info', message: 'System started successfully', service: 'ia-backend' },
  { level: 'info', message: 'Database initialized', service: 'ia-backend' },
  { level: 'warn', message: 'MQTT broker not available', service: 'mqtt' },
  { level: 'info', message: 'Flow Engine initialized', service: 'flow-engine' },
  { level: 'error', message: 'Failed to connect to device', service: 'zigbee' },
  { level: 'debug', message: 'Processing node output', service: 'flow-engine' },
  { level: 'info', message: 'WebSocket client connected', service: 'ia-backend' },
  { level: 'info', message: 'Flow deployed successfully', service: 'flow-engine' },
];

const stmt = db.prepare(`
  INSERT INTO system_logs (level, message, service, metadata)
  VALUES (?, ?, ?, ?)
`);

for (const log of testLogs) {
  stmt.run(log.level, log.message, log.service, null);
  console.log(`Inserted: [${log.level}] ${log.message}`);
}

const count = db.prepare('SELECT COUNT(*) as count FROM system_logs').get();
console.log(`\nTotal logs in database: ${count.count}`);

db.close();
console.log('Done!');
