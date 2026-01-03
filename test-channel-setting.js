#!/usr/bin/env node
/**
 * Test script for GPIO channel setting
 * Tests the channel select functionality directly
 */

const { getGPIOManager } = require('./backend/src/core/gpio-manager');

async function testChannelSetting() {
  console.log('=== GPIO Channel Setting Test ===\n');
  
  const gpio = getGPIOManager();
  
  // Initialize GPIO
  console.log('1. Initializing GPIO...');
  const initialized = await gpio.initialize();
  
  if (!initialized) {
    console.error('❌ GPIO initialization failed!');
    process.exit(1);
  }
  console.log('✅ GPIO initialized\n');
  
  // Display pin mapping
  console.log('Pin Mapping:');
  console.log(`  CS0: Physical Pin ${gpio.pins.CS0}`);
  console.log(`  CS1: Physical Pin ${gpio.pins.CS1}`);
  console.log(`  CS2: Physical Pin ${gpio.pins.CS2}`);
  console.log(`  CS3: Physical Pin ${gpio.pins.CS3}`);
  console.log('');
  
  // Test individual channel settings
  const channelsToTest = [0, 1, 2, 4, 8, 15];
  
  for (const channel of channelsToTest) {
    console.log(`2. Testing Channel ${channel}...`);
    
    // Calculate expected binary
    const cs0 = (channel & 0x01) !== 0 ? 1 : 0;
    const cs1 = (channel & 0x02) !== 0 ? 1 : 0;
    const cs2 = (channel & 0x04) !== 0 ? 1 : 0;
    const cs3 = (channel & 0x08) !== 0 ? 1 : 0;
    
    console.log(`   Binary: CS3=${cs3} CS2=${cs2} CS1=${cs1} CS0=${cs0}`);
    
    const success = await gpio.setChannel(channel);
    
    if (success) {
      console.log('   ✅ Channel set successfully');
      
      // Read back pin states
      const states = gpio.getPinStates();
      console.log('   Pin States:', {
        CS0: states[gpio.pins.CS0],
        CS1: states[gpio.pins.CS1],
        CS2: states[gpio.pins.CS2],
        CS3: states[gpio.pins.CS3]
      });
      
      // Verify
      if (states[gpio.pins.CS0] === cs0 &&
          states[gpio.pins.CS1] === cs1 &&
          states[gpio.pins.CS2] === cs2 &&
          states[gpio.pins.CS3] === cs3) {
        console.log('   ✅ Verification passed!');
      } else {
        console.log('   ❌ Verification FAILED - pins do not match expected values');
      }
    } else {
      console.log('   ❌ Channel set FAILED');
    }
    
    console.log('');
    
    // Wait 1 second between tests
    await gpio.sleep(1000);
  }
  
  // Test PTT
  console.log('3. Testing PTT...');
  await gpio.activatePTT();
  console.log('   ✅ PTT activated');
  await gpio.sleep(500);
  await gpio.deactivatePTT();
  console.log('   ✅ PTT deactivated\n');
  
  // Cleanup
  console.log('4. Cleaning up...');
  await gpio.cleanup();
  console.log('✅ Test complete!');
}

// Run the test
testChannelSetting().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
