const AWRERM100Interface = require('./src/interfaces/radio/awr-erm100');

console.log('AWR ERM100 Radio Interface Test');
console.log('================================\n');

async function runTest() {
  // Create radio interface with configuration
  const radio = new AWRERM100Interface({
    name: 'AWR ERM100 Test',
    channel: 0,
    preKeyDelay: 100,
    postKeyDelay: 100,
    clearChannelEnabled: false
  });

  // Listen to events
  radio.on('status-changed', (status) => {
    console.log(`Status: ${status}`);
  });

  radio.on('ptt-activated', (data) => {
    console.log(`✓ PTT ACTIVATED on channel ${data.channel}`);
  });

  radio.on('ptt-deactivated', (data) => {
    console.log(`✓ PTT DEACTIVATED on channel ${data.channel}`);
  });

  radio.on('channel-changed', (data) => {
    console.log(`✓ Channel changed to ${data.channel}`);
  });

  try {
    // Test 1: Connect
    console.log('Test 1: Connecting to radio...');
    await radio.connect();
    console.log('✓ Connected\n');

    // Test 2: Channel switching
    console.log('Test 2: Testing channel selection...');
    await radio.setChannel(5);
    console.log('✓ Channel 5 set\n');

    // Test 3: PTT pulse on channel 5
    console.log('Test 3: PTT pulse 2 seconds on channel 5...');
    await radio.pulsePTT(2000);
    console.log('✓ PTT pulse complete\n');

    // Test 4: Change channel and transmit
    console.log('Test 4: Transmit on channel 3...');
    await radio.transmit(1500, { channel: 3 });
    console.log('✓ Transmission complete\n');

    // Test 5: Multi-channel broadcast
    console.log('Test 5: Broadcasting to channels 1, 2, 3...');
    const results = await radio.broadcastMultiChannel([1, 2, 3], 1000, 500);
    console.log('✓ Multi-channel broadcast complete');
    console.log('  Results:', results);
    console.log('');

    // Test 6: Get status
    console.log('Test 6: Radio status...');
    const status = radio.getStatus();
    console.log(JSON.stringify(status, null, 2));
    console.log('');

    // Cleanup
    console.log('Disconnecting...');
    await radio.disconnect();
    console.log('✓ Disconnected\n');

    console.log('All tests passed! ✓');
    process.exit(0);

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    console.error(error.stack);
    
    try {
      await radio.disconnect();
    } catch (e) {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  }
}

runTest();
