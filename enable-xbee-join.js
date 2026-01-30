const { SerialPort } = require('serialport');

const port = new SerialPort({
  path: '/dev/ttyUSB5',
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1
});

let frameId = 1;

port.on('open', () => {
  console.log('Serial port opened\n');
  
  // Enable permit joining (NJ) for 255 seconds (0xFF)
  setTimeout(() => {
    console.log('Enabling permit joining for 255 seconds...');
    sendATCommand('NJ', Buffer.from([0xFF]));
  }, 1000);

  // Apply changes
  setTimeout(() => {
    console.log('Applying changes...');
    sendATCommand('AC', Buffer.alloc(0));
  }, 2000);

  setTimeout(() => {
    console.log('\nCoordinator now accepting joins for 255 seconds!');
    console.log('Press and hold the commissioning button on your XBee button now.');
    port.close();
    process.exit(0);
  }, 3500);
});

function sendATCommand(cmd, value) {
  const cmdBytes = Buffer.from(cmd, 'ascii');
  const frameData = Buffer.concat([
    Buffer.from([0x08]),
    Buffer.from([frameId++]),
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
  console.log('  Response:', data.toString('hex'));
});

port.on('error', (err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
