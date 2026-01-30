const Database = require('better-sqlite3');
const db = new Database('flows-temp.db', { readonly: true });

const flows = db.prepare('SELECT id, name, flow_data FROM flows').all();

flows.forEach(flow => {
  console.log(`\n=== Flow: ${flow.name} (${flow.id}) ===`);
  const flowData = JSON.parse(flow.flow_data);
  
  flowData.nodes.forEach(node => {
    if (node.type.includes('radio')) {
      console.log(`  [${node.type}] ${node.name || node.id}`);
      console.log(`    Config:`, JSON.stringify(node.config, null, 6));
    }
  });
});

db.close();
