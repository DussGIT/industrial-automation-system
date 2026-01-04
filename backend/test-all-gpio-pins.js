const { Chip } = require('node-libgpiod');

console.log('UP Board GPIO Test - All Radio Control Pins');
console.log('============================================\n');

const chip = new Chip(4); // UP Board CPLD chip

const pins = [
  { name: 'PTT (Pin 13)', line: 27 },
  { name: 'CS3 (Pin 15)', line: 22 },
  { name: 'CS2 (Pin 16)', line: 23 },
  { name: 'CS1 (Pin 18)', line: 24 },
  { name: 'CS0 (Pin 22)', line: 25 },
  { name: 'CLEAR (Pin 32)', line: 12 }
];

async function testPin(name, lineNum) {
  try {
    const line = chip.getLine(lineNum);
    line.requestOutputMode('test', 0);
    console.log(`✓ ${name} - Set LOW`);
    await new Promise(r => setTimeout(r, 100));
    
    line.setValue(1);
    console.log(`✓ ${name} - Set HIGH`);
    await new Promise(r => setTimeout(r, 100));
    
    line.setValue(0);
    console.log(`✓ ${name} - Set LOW\n`);
    
    line.release();
    return true;
  } catch (error) {
    console.error(`✗ ${name} - ERROR: ${error.message}\n`);
    return false;
  }
}

(async () => {
  for (const pin of pins) {
    await testPin(pin.name, pin.line);
  }
  console.log('Test complete!');
  process.exit(0);
})();
