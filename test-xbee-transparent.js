const { SerialPort } = require('serialport');

const port = new SerialPort({
  path: '/dev/ttyUSB5',
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1
});

let responseData = '';

port.on('open', () => {
  console.log('Serial port opened, testing transparent mode...\n');
  
  // Enter command mode with +++
  setTimeout(() => {
    console.log('Sending +++ to enter command mode...');
    port.write('+++');
  }, 2000);

  // Wait for OK
  setTimeout(() => {
    console.log('Sending ATNI to get Node Identifier...');
    port.write('ATNI\r');
  }, 4000);

  setTimeout(() => {
    console.log('Sending ATVR to get firmware version...');
    port.write('ATVR\r');
  }, 5000);

  setTimeout(() => {
    console.log('Sending ATID to get PAN ID...');
    port.write('ATID\r');
  }, 6000);

  setTimeout(() => {
    console.log('Sending ATMY to get my address...');
    port.write('ATMY\r');
  }, 7000);

  setTimeout(() => {
    console.log('Sending ATAP to check API mode setting...');
    port.write('ATAP\r');
  }, 8000);

  setTimeout(() => {
    console.log('\nTest complete');
    port.close();
    process.exit(0);
  }, 10000);
});

port.on('data', (data) => {
  const text = data.toString();
  responseData += text;
  console.log('Received:', text);
});

port.on('error', (err) => {
  console.error('Serial port error:', err.message);
  process.exit(1);
});
