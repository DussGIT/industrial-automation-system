const { SerialPort } = require('serialport');

const port = new SerialPort({
  path: '/dev/ttyUSB5',
  baudRate: 1200,  // Current baud rate
  dataBits: 8,
  parity: 'none',
  stopBits: 1
});

let frameId = 1;

port.on('open', () => {
  console.log('Serial port opened at 1200 baud\n');
  
  // Set baud rate to 9600 (BD=3)
  setTimeout(() => {
    console.log('Setting baud rate to 9600...');
    sendATCommand('BD', Buffer.from([0x03]));
  }, 1000);

  // Write to flash
  setTimeout(() => {
    console.log('Writing to flash...');
    sendATCommand('WR', Buffer.alloc(0));
  }, 2000);

  // Close and report success
  setTimeout(() => {
    console.log('\nBaud rate changed to 9600!');
    console.log('Now restart the backend container.');
    port.close();
    process.exit(0);
  }, 3500);
});

function sendATCommand(cmd, value) {
  const cmdBytes = Buffer.from(cmd, 'ascii');
  const frameData = Buffer.concat([
    Buffer.from([0x08]),  // AT Command frame type
    Buffer.from([frameId++]),  // Frame ID
    cmdBytes,
    value
  ]);
  
  let sum = 0;
  for (let byte of frameData) {
    sum += byte;
  }
  const checksum = 0xFF - (sum & 0xFF);
  
  const length = frameData.length;
  const frame = Buffer.concat([
    Buffer.from([0x7E]),
    Buffer.from([(length >> 8) & 0xFF, length & 0xFF]),
    frameData,
    Buffer.from([checksum])
  ]);
  
  port.write(frame);
}

port.on('data', (data) => {
  console.log('  Received:', data.toString('hex'));
});

port.on('error', (err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
