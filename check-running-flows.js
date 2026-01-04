const db = require('better-sqlite3')('/app/data/flows.db');
const flows = db.prepare("SELECT id, name, config FROM flows WHERE status = 'running'").all();
console.log('Running flows:', flows.length);
flows.forEach(f => {
  const config = JSON.parse(f.config);
  console.log('\nFlow:', f.name);
  console.log('Full config:', JSON.stringify(config, null, 2));
});
