const { SerialPort } = require('serialport');

const port = new SerialPort({
  path: '/dev/ttyUSB5',
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1
});

let buffer = Buffer.alloc(0);

port.on('open', () => {
  console.log('Serial port opened');
  
  // Wait a bit then try to get coordinator info
  setTimeout(() => {
    console.log('Sending AT command to get Node Identifier...');
    // API frame for ATNI command
    const frame = Buffer.from([
      0x7E,        // Start delimiter
      0x00, 0x04,  // Length
      0x08,        // AT Command
      0x01,        // Frame ID
      0x4E, 0x49,  // 'NI' command
      0x65         // Checksum
    ]);
    port.write(frame);
  }, 1000);

  setTimeout(() => {
    console.log('Sending AT command to get firmware version...');
    // API frame for ATVR command
    const frame = Buffer.from([
      0x7E,        // Start delimiter
      0x00, 0x04,  // Length
      0x08,        // AT Command
      0x02,        // Frame ID
      0x56, 0x52,  // 'VR' command
      0x4B         // Checksum
    ]);
    port.write(frame);
  }, 2000);

  setTimeout(() => {
    console.log('Sending AT command to get PAN ID...');
    // API frame for ATID command
    const frame = Buffer.from([
      0x7E,        // Start delimiter
      0x00, 0x04,  // Length
      0x08,        // AT Command
      0x03,        // Frame ID
      0x49, 0x44,  // 'ID' command
      0x6F         // Checksum
    ]);
    port.write(frame);
  }, 3000);

  setTimeout(() => {
    console.log('\nTest complete');
    port.close();
    process.exit(0);
  }, 5000);
});

port.on('data', (data) => {
  buffer = Buffer.concat([buffer, data]);
  console.log('Received data:', data.toString('hex'));
  
  // Try to parse API frames
  while (buffer.length > 0) {
    if (buffer[0] !== 0x7E) {
      console.log('No start delimiter, skipping byte');
      buffer = buffer.slice(1);
      continue;
    }
    
    if (buffer.length < 3) break;
    
    const length = buffer.readUInt16BE(1);
    if (buffer.length < length + 4) break;
    
    const frame = buffer.slice(0, length + 4);
    buffer = buffer.slice(length + 4);
    
    console.log('Complete frame:', frame.toString('hex'));
    parseATResponse(frame);
  }
});

port.on('error', (err) => {
  console.error('Serial port error:', err.message);
  process.exit(1);
});

function parseATResponse(frame) {
  if (frame.length < 5) return;
  
  const frameType = frame[3];
  if (frameType === 0x88) { // AT Command Response
    const frameId = frame[4];
    const command = String.fromCharCode(frame[5], frame[6]);
    const status = frame[7];
    const value = frame.slice(8, -1); // exclude checksum
    
    console.log('AT Response - Command: ' + command + ', Status: ' + (status === 0 ? 'OK' : 'ERROR'));
    
    if (status === 0 && value.length > 0) {
      if (command === 'NI') {
        console.log('  Node Identifier: ' + value.toString());
      } else if (command === 'VR') {
        console.log('  Firmware Version: ' + value.toString('hex'));
      } else if (command === 'ID') {
        console.log('  PAN ID: ' + value.toString('hex'));
      } else {
        console.log('  Value: ' + value.toString('hex'));
      }
    }
  }
}
