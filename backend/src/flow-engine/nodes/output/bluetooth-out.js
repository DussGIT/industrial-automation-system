const BaseNode = require('../base-node');
const { getBluetoothManager } = require('../../../core/bluetooth-manager');
const logger = require('../../../core/logger');

class BluetoothOutNode extends BaseNode {
  static type = 'bluetooth-out';
  static category = 'output';
  static label = 'Bluetooth Out';
  static icon = 'bluetooth';

  constructor(config) {
    super(config);
    this.deviceAddress = config.deviceAddress || null;
    this.serviceUuid = config.serviceUuid || null;
    this.characteristicUuid = config.characteristicUuid || null;
  }

  async start() {
    logger.info('Bluetooth Out node started', {
      service: 'flow-engine',
      nodeId: this.id
    });
  }

  async receive(data, sourcePort, targetPort) {
    try {
      const bluetoothManager = getBluetoothManager();

      // Get device address from message or node config
      const address = data.address || this.deviceAddress;
      const serviceUuid = data.serviceUuid || this.serviceUuid;
      const characteristicUuid = data.characteristicUuid || this.characteristicUuid;

      if (!address) {
        const error = 'No device address specified';
        logger.warn(error, {
          service: 'flow-engine',
          nodeId: this.id
        });
        
        this.send({
          ...data,
          error,
          success: false
        }, data);
        return;
      }

      if (!serviceUuid || !characteristicUuid) {
        const error = 'Service UUID and Characteristic UUID required';
        logger.warn(error, {
          service: 'flow-engine',
          nodeId: this.id
        });
        
        this.send({
          ...data,
          error,
          success: false
        }, data);
        return;
      }

      // Get data to send from message payload
      const payload = data.payload;

      if (!payload) {
        const error = 'No payload to send';
        logger.warn(error, {
          service: 'flow-engine',
          nodeId: this.id
        });
        
        this.send({
          ...data,
          error,
          success: false
        }, data);
        return;
      }

      // Record the data being sent (will be sent by frontend)
      bluetoothManager.recordDataSent(address, serviceUuid, characteristicUuid, payload);

      logger.info('Bluetooth Out node sent data', {
        service: 'flow-engine',
        nodeId: this.id,
        to: address,
        characteristic: characteristicUuid,
        dataLength: payload.length
      });

      // Send success message
      this.send({
        ...data,
        sent: true,
        success: true,
        timestamp: new Date().toISOString()
      }, data);

    } catch (error) {
      logger.error(`Bluetooth Out node error: ${error.message}`, {
        service: 'flow-engine',
        nodeId: this.id,
        error: error.message
      });

      // Send error message
      this.send({
        ...data,
        error: error.message,
        success: false
      }, data);
    }
  }

  async stop() {
    logger.info('Bluetooth Out node stopped', {
      service: 'flow-engine',
      nodeId: this.id
    });
  }

  // Validate node configuration
  validate() {
    const errors = [];
    
    if (!this.deviceAddress && !this.config.allowDynamicAddress) {
      errors.push('Device address is required');
    }
    
    if (!this.serviceUuid && !this.config.allowDynamicService) {
      errors.push('Service UUID is required');
    }
    
    if (!this.characteristicUuid && !this.config.allowDynamicCharacteristic) {
      errors.push('Characteristic UUID is required');
    }
    
    return errors;
  }
}

module.exports = BluetoothOutNode;
