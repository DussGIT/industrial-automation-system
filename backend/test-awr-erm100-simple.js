const { getGPIOManager } = require('./src/core/gpio-manager');

console.log('AWR ERM100 Radio Test - GPIO Direct');
console.log('====================================\n');

async function runTest() {
  const gpio = getGPIOManager();
  
  try {
    // Initialize GPIO
    console.log('Initializing GPIO...');
    await gpio.initialize();
    console.log('✓ GPIO initialized\n');

    // Test 1: Set channel 0
    console.log('Test 1: Setting channel 0 (all CS pins LOW)...');
    await gpio.setChannel(0);
    await sleep(500);
    console.log('✓ Channel 0 set\n');

    // Test 2: PTT pulse on channel 0
    console.log('Test 2: PTT pulse 2 seconds on channel 0...');
    await gpio.activatePTT();
    console.log('  PTT ON - radio should be transmitting');
    await sleep(2000);
    await gpio.deactivatePTT();
    console.log('  PTT OFF - radio should be receiving');
    console.log('✓ PTT pulse complete\n');

    // Test 3: Set channel 5
    console.log('Test 3: Setting channel 5 (CS0=1, CS2=1)...');
    await gpio.setChannel(5);
    await sleep(500);
    console.log('✓ Channel 5 set\n');

    // Test 4: PTT pulse on channel 5
    console.log('Test 4: PTT pulse 1.5 seconds on channel 5...');
    await gpio.activatePTT();
    console.log('  PTT ON');
    await sleep(1500);
    await gpio.deactivatePTT();
    console.log('  PTT OFF');
    console.log('✓ PTT pulse complete\n');

    // Test 5: Multi-channel broadcast simulation
    console.log('Test 5: Multi-channel broadcast (channels 1, 2, 3)...');
    const channels = [1, 2, 3];
    for (const ch of channels) {
      console.log(`  Channel ${ch}:`);
      await gpio.setChannel(ch);
      await sleep(100);
      console.log(`    PTT ON`);
      await gpio.activatePTT();
      await sleep(1000);
      await gpio.deactivatePTT();
      console.log(`    PTT OFF`);
      await sleep(300);
    }
    console.log('✓ Multi-channel broadcast complete\n');

    // Test 6: Return to channel 0
    console.log('Test 6: Returning to channel 0...');
    await gpio.setChannel(0);
    console.log('✓ Channel 0 set\n');

    // Get final status
    console.log('Final GPIO status:');
    const states = gpio.getPinStates();
    console.log('Pin states:', states);
    console.log('');

    console.log('All tests passed! ✓');
    console.log('\nRadio should now be on channel 0 in receive mode.');

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runTest();
