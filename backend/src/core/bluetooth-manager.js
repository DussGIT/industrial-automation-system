const logger = require('./logger');
const EventEmitter = require('events');
const { getDb } = require('./database');

// Try to load noble for native Bluetooth (optional)
let noble = null;
try {
  noble = require('@abandonware/noble');
} catch (error) {
  // Noble not available, will use Web Bluetooth mode
}

/**
 * Bluetooth Manager - Handles Bluetooth/BLE device discovery and communication
 * Supports two modes:
 * - 'native': Uses @abandonware/noble for native Bluetooth/BLE (Linux with BlueZ)
 * - 'web': Uses Web Bluetooth API through browser connections
 * Mode is determined by BLUETOOTH_MODE env var or auto-detected
 */
class BluetoothManager extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map(); // address -> device object
    this.connectedDevices = new Map(); // address -> device info
    this.initialized = false;
    this.mode = process.env.BLUETOOTH_MODE || (noble ? 'native' : 'web');
    this.isScanning = false;
    this.noble = noble;
  }

  /**
   * Initialize Bluetooth manager
   */
  async initialize() {
    try {
      logger.info(`Initializing Bluetooth Manager (${this.mode} mode)`, { 
        service: 'bluetooth', 
        siteId: 'site-001' 
      });

      // Load devices from database
      this.loadDevicesFromDb();

      if (this.mode === 'native' && this.noble) {
        // Native mode - setup noble event handlers
        this.setupNobleHandlers();
        this.initialized = true;
        
        logger.info('Bluetooth Manager initialized successfully', { 
          service: 'bluetooth', 
          siteId: 'site-001',
          mode: 'Native Bluetooth (noble/BlueZ)'
        });
      } else {
        // Web Bluetooth mode - devices registered from frontend
        this.initialized = true;
        
        logger.info('Bluetooth Manager initialized successfully', { 
          service: 'bluetooth', 
          siteId: 'site-001',
          mode: 'Web Bluetooth API (browser-based)'
        });
      }

      return true;
    } catch (error) {
      logger.error(`Bluetooth initialization failed: ${error.message}`, { 
        service: 'bluetooth',
        siteId: 'site-001',
        error: error.message 
      });
      this.initialized = false;
      return false;
    }
  }

  /**
   * Setup noble event handlers for native Bluetooth
   */
  setupNobleHandlers() {
    if (!this.noble) return;

    this.noble.on('stateChange', (state) => {
      logger.info(`Bluetooth adapter state: ${state}`, { service: 'bluetooth' });
      
      if (state === 'poweredOn') {
        // Auto-start scanning when adapter is ready
        this.startScanning();
      } else {
        this.stopScanning();
      }
    });

    this.noble.on('discover', (peripheral) => {
      this.handleNobleDiscovery(peripheral);
    });
  }

  /**
   * Handle device discovery from noble
   */
  handleNobleDiscovery(peripheral) {
    const address = peripheral.address || peripheral.id;
    const name = peripheral.advertisement?.localName || 'Unknown Device';
    const rssi = peripheral.rssi;
    const services = peripheral.advertisement?.serviceUuids || [];

    if (!this.devices.has(address)) {
      const device = {
        address,
        name,
        type: 'bluetooth',
        rssi,
        services,
        peripheral, // Keep reference for connection
        connected: false,
        lastSeen: new Date().toISOString(),
        firstSeen: new Date().toISOString()
      };

      this.devices.set(address, device);
      this.saveDeviceToDb(device);

      logger.info(`Discovered Bluetooth device`, {
        service: 'bluetooth',
        address,
        name,
        rssi
      });

      this.emit('device:discovered', device);
    } else {
      // Update existing device
      const device = this.devices.get(address);
      device.rssi = rssi;
      device.lastSeen = new Date().toISOString();
      this.emit('device:updated', device);
    }
  }

  /**
   * Start scanning for devices (native mode only)
   */
  async startScanning() {
    if (this.mode !== 'native' || !this.noble) {
      logger.warn('Scanning only available in native mode', { service: 'bluetooth' });
      return false;
    }

    if (this.noble.state !== 'poweredOn') {
      logger.warn('Bluetooth adapter not powered on', { service: 'bluetooth' });
      return false;
    }

    if (this.isScanning) {
      return true;
    }

    try {
      await this.noble.startScanningAsync([], true); // Allow duplicates for RSSI updates
      this.isScanning = true;
      logger.info('Started Bluetooth scanning', { service: 'bluetooth' });
      return true;
    } catch (error) {
      logger.error(`Failed to start scanning: ${error.message}`, { service: 'bluetooth' });
      return false;
    }
  }

  /**
   * Stop scanning for devices (native mode only)
   */
  async stopScanning() {
    if (this.mode !== 'native' || !this.noble || !this.isScanning) {
      return;
    }

    try {
      await this.noble.stopScanningAsync();
      this.isScanning = false;
      logger.info('Stopped Bluetooth scanning', { service: 'bluetooth' });
    } catch (error) {
      logger.error(`Failed to stop scanning: ${error.message}`, { service: 'bluetooth' });
    }
  }

  /**
   * Register a device from frontend
   */
  registerDevice(deviceInfo) {
    const { address, name, services, capabilities } = deviceInfo;

    if (!this.devices.has(address)) {
      const device = {
        address,
        name: name || 'Unknown Device',
        type: 'bluetooth',
        services: services || [],
        capabilities: capabilities || {},
        connected: false,
        lastSeen: new Date().toISOString(),
        firstSeen: new Date().toISOString()
      };

      this.devices.set(address, device);
      this.saveDeviceToDb(device);

      logger.info(`Registered Bluetooth device`, {
        service: 'bluetooth',
        siteId: 'site-001',
        address,
        name: device.name
      });

      this.emit('device:discovered', device);
      return device;
    } else {
      // Update existing device
      const device = this.devices.get(address);
      device.name = name || device.name;
      device.services = services || device.services;
      device.capabilities = capabilities || device.capabilities;
      device.lastSeen = new Date().toISOString();
      this.saveDeviceToDb(device);
      
      this.emit('device:updated', device);
      return device;
    }
  }

  /**
   * Mark device as connected (called from frontend)
   */
  setDeviceConnected(address, connected) {
    const device = this.devices.get(address);
    
    if (device) {
      device.connected = connected;
      device.lastSeen = new Date().toISOString();
      this.saveDeviceToDb(device);

      if (connected) {
        this.connectedDevices.set(address, { connectedAt: Date.now() });
        logger.info(`Device connected: ${device.name} (${address})`, { 
          service: 'bluetooth',
          siteId: 'site-001'
        });
        this.emit('device:connected', { address, name: device.name });
      } else {
        this.connectedDevices.delete(address);
        logger.info(`Device disconnected: ${device.name} (${address})`, { 
          service: 'bluetooth',
          siteId: 'site-001'
        });
        this.emit('device:disconnected', { address });
      }
    }
  }

  /**
   * Record data received from a device
   */
  recordData(address, serviceUuid, characteristicUuid, data) {
    const device = this.devices.get(address);
    
    if (device) {
      device.lastSeen = new Date().toISOString();
    }

    logger.info(`Data received from Bluetooth device`, {
      service: 'bluetooth',
      siteId: 'site-001',
      address,
      serviceUuid,
      characteristicUuid,
      data: typeof data === 'string' ? data : JSON.stringify(data)
    });

    this.emit('data:received', {
      address,
      serviceUuid,
      characteristicUuid,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Record data sent to a device
   */
  recordDataSent(address, serviceUuid, characteristicUuid, data) {
    const device = this.devices.get(address);
    
    if (device) {
      device.lastSeen = new Date().toISOString();
    }

    logger.info(`Data sent to Bluetooth device`, {
      service: 'bluetooth',
      siteId: 'site-001',
      address,
      serviceUuid,
      characteristicUuid,
      data: typeof data === 'string' ? data : JSON.stringify(data)
    });

    this.emit('data:sent', {
      address,
      serviceUuid,
      characteristicUuid,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get all discovered devices
   */
  getAllDevices() {
    return Array.from(this.devices.values()).map(device => ({
      address: device.address,
      name: device.name,
      type: device.type,
      rssi: device.rssi,
      manufacturer: device.manufacturer,
      services: device.services,
      connectable: device.connectable,
      connected: device.connected || false,
      lastSeen: device.lastSeen,
      firstSeen: device.firstSeen,
      capabilities: device.capabilities || {}
    }));
  }

  /**
   * Get device by address
   */
  getDevice(address) {
    return this.devices.get(address);
  }

  /**
   * Load devices from database
   */
  loadDevicesFromDb() {
    try {
      const db = getDb();
      const stmt = db.prepare('SELECT * FROM devices WHERE type = ?');
      const rows = stmt.all('bluetooth');
      
      for (const row of rows) {
        const capabilities = row.capabilities ? JSON.parse(row.capabilities) : null;
        const metadata = row.metadata ? JSON.parse(row.metadata) : {};
        
        const device = {
          address: row.address,
          name: row.name || 'Unknown Device',
          type: 'bluetooth',
          services: metadata.services || [],
          capabilities: capabilities || {},
          connected: false,
          lastSeen: row.last_seen ? new Date(row.last_seen * 1000).toISOString() : null,
          firstSeen: row.created_at ? new Date(row.created_at * 1000).toISOString() : null
        };
        
        this.devices.set(row.address, device);
      }
      
      logger.info(`Loaded ${rows.length} Bluetooth devices from database`, {
        service: 'bluetooth'
      });
    } catch (error) {
      logger.warn(`Failed to load Bluetooth devices from database: ${error.message}`, {
        service: 'bluetooth',
        error: error.message
      });
    }
  }

  /**
   * Save device to database
   */
  saveDeviceToDb(device) {
    try {
      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO devices (address, type, name, capabilities, metadata, status, last_seen, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
        ON CONFLICT(address) DO UPDATE SET
          name = excluded.name,
          capabilities = excluded.capabilities,
          metadata = excluded.metadata,
          status = excluded.status,
          last_seen = excluded.last_seen,
          updated_at = strftime('%s', 'now')
      `);
      
      const lastSeenTimestamp = device.lastSeen ? Math.floor(new Date(device.lastSeen).getTime() / 1000) : null;
      const capabilities = device.capabilities ? JSON.stringify(device.capabilities) : null;
      const metadata = JSON.stringify({
        services: device.services || []
      });
      
      stmt.run(
        device.address,
        'bluetooth',
        device.name,
        capabilities,
        metadata,
        device.connected ? 'connected' : 'disconnected',
        lastSeenTimestamp
      );
    } catch (error) {
      logger.warn(`Failed to save Bluetooth device to database: ${error.message}`, {
        service: 'bluetooth',
        error: error.message
      });
    }
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      mode: this.mode,
      adapterState: this.noble?.state || 'unavailable',
      isScanning: this.isScanning,
      devicesDiscovered: this.devices.size,
      devicesConnected: this.connectedDevices.size,
      devices: this.getAllDevices()
    };
  }

  /**
   * Remove a device
   */
  removeDevice(address) {
    const device = this.devices.get(address);
    
    if (device) {
      this.devices.delete(address);
      this.connectedDevices.delete(address);
      
      // Remove from database
      try {
        const db = getDb();
        const stmt = db.prepare('DELETE FROM devices WHERE address = ?');
        stmt.run(address);
      } catch (error) {
        logger.warn(`Failed to remove device from database: ${error.message}`, {
          service: 'bluetooth',
          error: error.message
        });
      }
      
      logger.info(`Removed Bluetooth device: ${device.name} (${address})`, { 
        service: 'bluetooth',
        siteId: 'site-001'
      });
      
      this.emit('device:removed', { address });
      return true;
    }
    
    return false;
  }

  /**
   * Cleanup
   */
  async shutdown() {
    logger.info('Shutting down Bluetooth Manager', { service: 'bluetooth', siteId: 'site-001' });

    this.connectedDevices.clear();
    this.devices.clear();
    this.initialized = false;

    logger.info('Bluetooth Manager shutdown complete', { service: 'bluetooth', siteId: 'site-001' });
  }
}

// Singleton instance
let bluetoothManagerInstance = null;

module.exports = {
  getBluetoothManager: () => {
    if (!bluetoothManagerInstance) {
      bluetoothManagerInstance = new BluetoothManager();
    }
    return bluetoothManagerInstance;
  },
  BluetoothManager
};
