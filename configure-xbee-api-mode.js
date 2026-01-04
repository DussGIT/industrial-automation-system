const { SerialPort } = require('serialport');

const port = new SerialPort({
  path: '/dev/ttyUSB5',
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1
});

port.on('open', () => {
  console.log('Serial port opened\n');
  
  // Enter command mode
  setTimeout(() => {
    console.log('Entering command mode...');
    port.write('+++');
  }, 2000);

  // Set API mode to 1 (API enabled)
  setTimeout(() => {
    console.log('Setting API mode to 1...');
    port.write('ATAP1\r');
  }, 4000);

  // Write changes to flash
  setTimeout(() => {
    console.log('Writing configuration to flash...');
    port.write('ATWR\r');
  }, 5000);

  // Apply changes
  setTimeout(() => {
    console.log('Applying changes...');
    port.write('ATAC\r');
  }, 6000);

  // Exit command mode
  setTimeout(() => {
    console.log('Exiting command mode...');
    port.write('ATCN\r');
  }, 7000);

  setTimeout(() => {
    console.log('\nConfiguration complete! XBee is now in API mode.');
    console.log('Restarting backend...');
    port.close();
    process.exit(0);
  }, 9000);
});

port.on('data', (data) => {
  const text = data.toString().trim();
  if (text) {
    console.log('  Response:', text);
  }
});

port.on('error', (err) => {
  console.error('Serial port error:', err.message);
  process.exit(1);
});
