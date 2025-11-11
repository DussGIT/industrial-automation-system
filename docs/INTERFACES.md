# Communication Interfaces Architecture

This document describes the architecture for industrial communication interfaces including radio systems, wireless protocols, and network protocols.

## Overview

The system supports multiple communication interfaces through a plugin-based architecture. Each interface type implements a standard interface that allows the flow engine to interact with it consistently.

## Supported Interfaces

### Radio Systems

#### Ritron DTX Radio
- **Type**: `radio-ritron-dtx`
- **Category**: Radio
- **Connection**: Serial (RS-232/USB)
- **Features**:
  - PTT (Push-to-Talk) control
  - Audio transmission
  - Status monitoring
  - Channel selection
  - RSSI monitoring

#### Motorola DLR Radio
- **Type**: `radio-motorola-dlr`
- **Category**: Radio
- **Connection**: Serial or Network
- **Features**:
  - Digital voice
  - Text messaging
  - GPS location
  - Man-down alert
  - Channel management

### Wireless Protocols

#### Zigbee
- **Type**: `zigbee`
- **Category**: Wireless
- **Connection**: USB dongle (e.g., ConBee II, CC2531)
- **Features**:
  - Mesh networking
  - Device pairing
  - Attribute reading/writing
  - Scene control
  - OTA updates

#### Bluetooth/BLE
- **Type**: `bluetooth`
- **Category**: Wireless
- **Connection**: Built-in Bluetooth adapter
- **Features**:
  - Device scanning
  - GATT services
  - Characteristic read/write
  - Notifications
  - Beacons

### Network Protocols

#### Modbus TCP
- **Type**: `modbus-tcp`
- **Category**: Network
- **Connection**: Ethernet/TCP
- **Features**:
  - Read/write coils
  - Read/write registers
  - Multiple device support
  - Polling/event-based

#### Modbus RTU
- **Type**: `modbus-rtu`
- **Category**: Network
- **Connection**: Serial (RS-485/RS-232)
- **Features**:
  - Same as Modbus TCP
  - Serial communication
  - CRC checking

#### OPC UA
- **Type**: `opcua`
- **Category**: Network
- **Connection**: TCP/IP
- **Features**:
  - Subscribe to node changes
  - Read/write variables
  - Browse server namespace
  - Security (encryption/certificates)
  - Historical data access

#### MQTT
- **Type**: `mqtt`
- **Category**: Network
- **Connection**: TCP/IP
- **Features**:
  - Publish/subscribe
  - QoS levels
  - Retained messages
  - Last will and testament
  - TLS/SSL support

## Interface Plugin Architecture

### Base Interface Class

All interface plugins extend the `BaseInterface` class:

```javascript
class BaseInterface extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id;
    this.type = config.type;
    this.name = config.name;
    this.config = config.config;
    this.status = 'inactive';
  }

  async connect() {
    // Implement in subclass
  }

  async disconnect() {
    // Implement in subclass
  }

  async read(params) {
    // Implement in subclass
  }

  async write(params) {
    // Implement in subclass
  }

  getStatus() {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      // ... additional status info
    };
  }
}
```

### Events

Interfaces emit the following events:
- `connected` - Interface successfully connected
- `disconnected` - Interface disconnected
- `error` - Error occurred
- `data` - Data received from interface
- `status` - Status update

### Registration

Interfaces are registered at startup:

```javascript
const interfaceRegistry = new InterfaceRegistry();

// Register interface types
interfaceRegistry.register('radio-ritron-dtx', RitronDTXInterface);
interfaceRegistry.register('radio-motorola-dlr', MotorolaDLRInterface);
interfaceRegistry.register('zigbee', ZigbeeInterface);
interfaceRegistry.register('bluetooth', BluetoothInterface);
interfaceRegistry.register('modbus-tcp', ModbusTCPInterface);
interfaceRegistry.register('modbus-rtu', ModbusRTUInterface);
interfaceRegistry.register('opcua', OPCUAInterface);
interfaceRegistry.register('mqtt', MQTTInterface);
```

## Node Types for Interfaces

Each interface type has corresponding flow nodes:

### Radio Nodes

- **radio-dtx-transmit**: Transmit audio/data via Ritron DTX
- **radio-dtx-receive**: Receive from Ritron DTX
- **radio-dlr-message**: Send text message via Motorola DLR
- **radio-dlr-location**: Get GPS location from DLR

### Zigbee Nodes

- **zigbee-device**: Control Zigbee device
- **zigbee-sensor**: Read Zigbee sensor
- **zigbee-scene**: Trigger Zigbee scene

### Bluetooth Nodes

- **ble-scan**: Scan for BLE devices
- **ble-read**: Read BLE characteristic
- **ble-write**: Write BLE characteristic
- **ble-notify**: Subscribe to BLE notifications

### Modbus Nodes

- **modbus-read**: Read Modbus registers/coils
- **modbus-write**: Write Modbus registers/coils
- **modbus-poll**: Continuous polling

### OPC UA Nodes

- **opcua-read**: Read OPC UA variable
- **opcua-write**: Write OPC UA variable
- **opcua-subscribe**: Subscribe to value changes
- **opcua-browse**: Browse server namespace

## Implementation Priority

### Phase 1 (Core Foundation)
- ✅ MQTT (already implemented)
- Modbus TCP
- Modbus RTU

### Phase 2 (Wireless)
- Zigbee
- Bluetooth/BLE

### Phase 3 (Radio)
- Ritron DTX
- Motorola DLR

### Phase 4 (Advanced)
- OPC UA
- Additional protocols as needed

## Hardware Requirements

### For Radio Interfaces
- USB-to-Serial adapters (FTDI recommended)
- Proper cabling for radio connections
- Radio programming cables

### For Zigbee
- Zigbee USB coordinator (ConBee II, CC2531, or similar)
- Zigbee devices (switches, sensors, etc.)

### For Bluetooth
- UP Board has built-in Bluetooth
- External BLE adapters supported

### For Modbus
- RS-485/RS-232 USB adapters for RTU
- Ethernet connection for TCP

### For OPC UA
- Network connection to OPC UA server

## Configuration Examples

### Ritron DTX Radio
```json
{
  "id": "dtx-1",
  "type": "radio-ritron-dtx",
  "name": "Main Radio",
  "config": {
    "port": "/dev/ttyUSB0",
    "baudRate": 9600,
    "channel": 1,
    "pttPin": 4
  }
}
```

### Zigbee
```json
{
  "id": "zigbee-1",
  "type": "zigbee",
  "name": "Zigbee Network",
  "config": {
    "port": "/dev/ttyUSB1",
    "panId": 6754,
    "channel": 11,
    "permitJoin": false
  }
}
```

### Modbus TCP
```json
{
  "id": "modbus-1",
  "type": "modbus-tcp",
  "name": "PLC Connection",
  "config": {
    "host": "192.168.1.100",
    "port": 502,
    "unitId": 1,
    "timeout": 5000
  }
}
```

## Testing

Each interface should include:
- Unit tests for core functionality
- Integration tests with real hardware (where possible)
- Mock/simulator for development without hardware
- Documentation for physical setup

## Security Considerations

- Serial port access requires proper permissions
- Network interfaces should support authentication
- TLS/SSL for network protocols where supported
- Configuration validation to prevent misuse
- Audit logging of all interface operations
