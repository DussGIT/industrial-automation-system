const { Chip } = require('node-libgpiod');

console.log('Direct GPIO Hardware Test - Pin 13 (line 17)');
console.log('===========================================');

try {
  const chip = new Chip(0);
  console.log('✓ Opened gpiochip0');
  
  const line = chip.getLine(17);
  console.log('✓ Got line 17');
  
  line.requestOutputMode('test-script', 0);
  console.log('✓ Requested output mode, set to LOW');
  console.log('  >> Check pin 13 with meter - should be 0V');
  
  setTimeout(() => {
    console.log('\nSetting to HIGH...');
    line.setValue(1);
    console.log('✓ Set to HIGH');
    console.log('  >> Check pin 13 with meter - should be 3.3V');
    
    setTimeout(() => {
      console.log('\nSetting back to LOW...');
      line.setValue(0);
      console.log('✓ Set to LOW');
      console.log('  >> Check pin 13 with meter - should be 0V');
      
      setTimeout(() => {
        line.release();
        chip.close();
        console.log('\n✓ Test complete - line released');
        process.exit(0);
      }, 2000);
    }, 3000);
  }, 2000);
  
} catch (error) {
  console.error('✗ ERROR:', error.message);
  process.exit(1);
}
