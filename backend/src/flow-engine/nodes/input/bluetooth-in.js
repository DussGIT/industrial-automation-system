const BaseNode = require('../base-node');
const { getBluetoothManager } = require('../../../core/bluetooth-manager');
const logger = require('../../../core/logger');

class BluetoothInNode extends BaseNode {
  static type = 'bluetooth-in';
  static category = 'input';
  static label = 'Bluetooth In';
  static icon = 'bluetooth';

  constructor(config) {
    super(config);
    this.deviceAddress = config.deviceAddress || null; // null = receive from all devices
    this.serviceUuid = config.serviceUuid || null;
    this.characteristicUuid = config.characteristicUuid || null;
    this.dataHandler = null;
  }

  async start() {
    try {
      const bluetoothManager = getBluetoothManager();

      // Create data handler
      this.dataHandler = (event) => {
        // Filter by device address if specified
        if (this.deviceAddress && event.address !== this.deviceAddress) {
          return;
        }

        // Filter by service UUID if specified
        if (this.serviceUuid && event.serviceUuid !== this.serviceUuid) {
          return;
        }

        // Filter by characteristic UUID if specified
        if (this.characteristicUuid && event.characteristicUuid !== this.characteristicUuid) {
          return;
        }

        const data = {
          payload: event.data,
          address: event.address,
          serviceUuid: event.serviceUuid,
          characteristicUuid: event.characteristicUuid,
          timestamp: event.timestamp,
          topic: `bluetooth/${event.address}/${event.characteristicUuid}`
        };

        this.send(data);

        logger.debug('Bluetooth In node received data', {
          service: 'flow-engine',
          nodeId: this.id,
          from: event.address,
          characteristic: event.characteristicUuid
        });
      };

      // Subscribe to Bluetooth data events
      bluetoothManager.on('data:received', this.dataHandler);

      logger.info('Bluetooth In node started', {
        service: 'flow-engine',
        nodeId: this.id,
        filter: {
          device: this.deviceAddress || 'all devices',
          service: this.serviceUuid || 'all services',
          characteristic: this.characteristicUuid || 'all characteristics'
        }
      });
    } catch (error) {
      logger.error(`Bluetooth In node start failed: ${error.message}`, {
        service: 'flow-engine',
        nodeId: this.id,
        error: error.message
      });
    }
  }

  async receive(data, sourcePort, targetPort) {
    // Input nodes don't process incoming messages
    // They only emit messages when data is received from Bluetooth devices
  }

  async stop() {
    try {
      if (this.dataHandler) {
        const bluetoothManager = getBluetoothManager();
        bluetoothManager.removeListener('data:received', this.dataHandler);
        this.dataHandler = null;
      }

      logger.info('Bluetooth In node stopped', {
        service: 'flow-engine',
        nodeId: this.id
      });
    } catch (error) {
      logger.error(`Bluetooth In node stop failed: ${error.message}`, {
        service: 'flow-engine',
        nodeId: this.id,
        error: error.message
      });
    }
  }
}

module.exports = BluetoothInNode;
