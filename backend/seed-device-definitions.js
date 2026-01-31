/**
 * Seed default device definitions into database
 * Run this after database initialization
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || './data/automation.db';
const definitionsPath = path.join(__dirname, 'device-definitions');

console.log('Seeding device definitions...');
console.log('Database:', dbPath);
console.log('Definitions path:', definitionsPath);

try {
  const db = new Database(dbPath);
  
  // Read all definition files
  const files = fs.readdirSync(definitionsPath);
  
  let seeded = 0;
  let updated = 0;
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    const filePath = path.join(definitionsPath, file);
    const definition = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    const { id, deviceType, manufacturer, model, version } = definition;
    
    if (!id || !deviceType || !manufacturer || !model || !version) {
      console.warn(`Skipping ${file}: missing required fields`);
      continue;
    }
    
    const now = Math.floor(Date.now() / 1000);
    
    // Check if exists
    const existing = db.prepare('SELECT id FROM device_definitions WHERE id = ?').get(id);
    
    if (existing) {
      // Update
      db.prepare(`
        UPDATE device_definitions 
        SET device_type = ?, manufacturer = ?, model = ?, version = ?, 
            definition = ?, source = ?, updated_at = ?
        WHERE id = ?
      `).run(
        deviceType,
        manufacturer,
        model,
        version,
        JSON.stringify(definition),
        'seeded',
        now,
        id
      );
      
      console.log(`✓ Updated: ${manufacturer} ${model} (${id})`);
      updated++;
    } else {
      // Insert
      db.prepare(`
        INSERT INTO device_definitions 
        (id, device_type, manufacturer, model, version, definition, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        deviceType,
        manufacturer,
        model,
        version,
        JSON.stringify(definition),
        'seeded',
        now,
        now
      );
      
      console.log(`✓ Seeded: ${manufacturer} ${model} (${id})`);
      seeded++;
    }
  }
  
  db.close();
  
  console.log('\nDevice definitions seeding complete!');
  console.log(`Seeded: ${seeded}, Updated: ${updated}`);
  
} catch (error) {
  console.error('Error seeding device definitions:', error);
  process.exit(1);
}
