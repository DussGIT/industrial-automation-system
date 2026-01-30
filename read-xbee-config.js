const { SerialPort } = require('serialport');

const port = new SerialPort({
  path: '/dev/ttyUSB5',
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1
});

let buffer = Buffer.alloc(0);
let frameId = 1;

const commands = [
  { cmd: 'AP', name: 'API Mode', delay: 1000 },
  { cmd: 'BD', name: 'Baud Rate', delay: 1500 },
  { cmd: 'ID', name: 'PAN ID', delay: 2000 },
  { cmd: 'CH', name: 'Channel', delay: 2500 },
  { cmd: 'NI', name: 'Node Identifier', delay: 3000 },
  { cmd: 'VR', name: 'Firmware Version', delay: 3500 }
];

port.on('open', () => {
  console.log('Serial port opened\n');
  console.log('Reading XBee configuration...\n');
  
  commands.forEach(({ cmd, name, delay }) => {
    setTimeout(() => {
      console.log(`Querying ${name} (${cmd})...`);
      sendATCommand(cmd);
    }, delay);
  });

  setTimeout(() => {
    console.log('\nConfiguration read complete');
    port.close();
    process.exit(0);
  }, 5000);
});

function sendATCommand(cmd) {
  // Build AT Command API frame
  const cmdBytes = Buffer.from(cmd, 'ascii');
  const frameData = Buffer.concat([
    Buffer.from([0x08]),  // AT Command frame type
    Buffer.from([frameId++]),  // Frame ID
    cmdBytes
  ]);
  
  // Calculate checksum
  let sum = 0;
  for (let byte of frameData) {
    sum += byte;
  }
  const checksum = 0xFF - (sum & 0xFF);
  
  // Build complete frame
  const length = frameData.length;
  const frame = Buffer.concat([
    Buffer.from([0x7E]),  // Start delimiter
    Buffer.from([(length >> 8) & 0xFF, length & 0xFF]),  // Length
    frameData,
    Buffer.from([checksum])
  ]);
  
  port.write(frame);
}

port.on('data', (data) => {
  buffer = Buffer.concat([buffer, data]);
  
  // Try to parse API frames
  while (buffer.length > 0) {
    if (buffer[0] !== 0x7E) {
      buffer = buffer.slice(1);
      continue;
    }
    
    if (buffer.length < 3) break;
    
    const length = buffer.readUInt16BE(1);
    if (buffer.length < length + 4) break;
    
    const frame = buffer.slice(0, length + 4);
    buffer = buffer.slice(length + 4);
    
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
    const atCmd = String.fromCharCode(frame[5], frame[6]);
    const status = frame[7];
    const value = frame.slice(8, -1); // Exclude checksum
    
    console.log(`  ${atCmd} Response (Frame ${frameId}): Status=${status}`);
    
    if (status === 0) {
      // Parse based on command
      if (atCmd === 'AP') {
        console.log(`    API Mode: ${value[0]} (0=Transparent, 1=API, 2=API Escaped)`);
      } else if (atCmd === 'BD') {
        const baudMap = { 0: 1200, 1: 2400, 2: 4800, 3: 9600, 4: 19200, 5: 38400, 6: 57600, 7: 115200 };
        console.log(`    Baud Rate: ${baudMap[value[0]] || value[0]}`);
      } else if (atCmd === 'ID') {
        console.log(`    PAN ID: 0x${value.toString('hex').toUpperCase()}`);
      } else if (atCmd === 'CH') {
        console.log(`    Channel: ${value[0]} (0x${value[0].toString(16)})`);
      } else if (atCmd === 'NI') {
        console.log(`    Node Identifier: "${value.toString('ascii')}"`);
      } else if (atCmd === 'VR') {
        console.log(`    Firmware Version: 0x${value.toString('hex').toUpperCase()}`);
      } else {
        console.log(`    Value: ${value.toString('hex')}`);
      }
    } else {
      console.log(`    ERROR: Status ${status}`);
    }
    console.log();
  }
}
