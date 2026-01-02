import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Bluetooth, 
  BluetoothConnected, 
  BluetoothSearching,
  RefreshCw,
  Wifi,
  WifiOff,
  Trash2,
  Link,
  Unlink
} from 'lucide-react';

// Common Bluetooth GATT UUIDs with human-readable names
const GATT_SERVICES = {
  '00001800-0000-1000-8000-00805f9b34fb': 'Generic Access',
  '00001801-0000-1000-8000-00805f9b34fb': 'Generic Attribute',
  '0000180a-0000-1000-8000-00805f9b34fb': 'Device Information',
  '0000180f-0000-1000-8000-00805f9b34fb': 'Battery Service',
  '00001805-0000-1000-8000-00805f9b34fb': 'Current Time Service',
  '0000181a-0000-1000-8000-00805f9b34fb': 'Environmental Sensing',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e': 'Nordic UART Service',
  'a000': 'Ruuvi Accelerometer',
};

const GATT_CHARACTERISTICS = {
  '00002a00-0000-1000-8000-00805f9b34fb': 'Device Name',
  '00002a01-0000-1000-8000-00805f9b34fb': 'Appearance',
  '00002a04-0000-1000-8000-00805f9b34fb': 'Peripheral Preferred Connection Parameters',
  '00002aa6-0000-1000-8000-00805f9b34fb': 'Central Address Resolution',
  '00002a05-0000-1000-8000-00805f9b34fb': 'Service Changed',
  '00002a29-0000-1000-8000-00805f9b34fb': 'Manufacturer Name String',
  '00002a24-0000-1000-8000-00805f9b34fb': 'Model Number String',
  '00002a25-0000-1000-8000-00805f9b34fb': 'Serial Number String',
  '00002a27-0000-1000-8000-00805f9b34fb': 'Hardware Revision String',
  '00002a26-0000-1000-8000-00805f9b34fb': 'Firmware Revision String',
  '00002a28-0000-1000-8000-00805f9b34fb': 'Software Revision String',
  '00002a19-0000-1000-8000-00805f9b34fb': 'Battery Level',
  '00002a6e-0000-1000-8000-00805f9b34fb': 'Temperature',
  '00002a6f-0000-1000-8000-00805f9b34fb': 'Humidity',
  '00002a6d-0000-1000-8000-00805f9b34fb': 'Pressure',
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e': 'Nordic UART RX',
  '6e400003-b5a3-f393-e0a9-e50e24dcca9e': 'Nordic UART TX',
};

// Helper function to get friendly name for UUID
const getUuidName = (uuid, type = 'service') => {
  const lookupTable = type === 'service' ? GATT_SERVICES : GATT_CHARACTERISTICS;
  const fullUuid = uuid.length === 4 ? `0000${uuid}-0000-1000-8000-00805f9b34fb` : uuid;
  return lookupTable[fullUuid] || lookupTable[uuid] || null;
};

const BluetoothMonitor = () => {
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [btDevice, setBtDevice] = useState(null);
  const [deviceServices, setDeviceServices] = useState({});
  const [characteristicValues, setCharacteristicValues] = useState({});
  const [bluetoothMode, setBluetoothMode] = useState('web'); // 'native' or 'web'

  // Fetch Bluetooth status to determine mode
  const { data: statusData } = useQuery({
    queryKey: ['bluetooth-status'],
    queryFn: async () => {
      const response = await fetch('/api/bluetooth/status');
      if (!response.ok) throw new Error('Failed to fetch Bluetooth status');
      return response.json();
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  // Update mode when status changes
  useEffect(() => {
    if (statusData?.mode) {
      setBluetoothMode(statusData.mode);
    }
  }, [statusData]);

  // Fetch Bluetooth devices
  const { data: devicesData, isLoading, refetch } = useQuery({
    queryKey: ['bluetooth-devices'],
    queryFn: async () => {
      const response = await fetch('/api/bluetooth/devices');
      if (!response.ok) throw new Error('Failed to fetch Bluetooth devices');
      return response.json();
    },
    refetchInterval: 10000, // Reduced frequency to 10 seconds
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
  });

  const devices = devicesData?.devices || [];

  // Load device services from capabilities when devices change
  useEffect(() => {
    console.log('Devices changed, rebuilding capabilities display:', devices);
    if (devices.length > 0) {
      const newDeviceServices = {};
      devices.forEach(device => {
        console.log(`Device ${device.name}:`, {
          hasCapabilities: !!device.capabilities,
          capabilitiesCount: device.capabilities ? Object.keys(device.capabilities).length : 0,
          capabilities: device.capabilities
        });
        
        if (device.capabilities && Object.keys(device.capabilities).length > 0) {
          // Rebuild serviceData from capabilities
          const serviceData = {};
          Object.values(device.capabilities).forEach(cap => {
            if (!serviceData[cap.serviceUuid]) {
              serviceData[cap.serviceUuid] = { characteristics: [] };
            }
            serviceData[cap.serviceUuid].characteristics.push({
              uuid: cap.characteristicUuid,
              properties: cap.properties
            });
          });
          newDeviceServices[device.address] = serviceData;
          console.log(`Built service data for ${device.name}:`, serviceData);
        } else {
          console.log(`No capabilities found for ${device.name}`);
        }
      });
      setDeviceServices(newDeviceServices);
      console.log('Final deviceServices:', newDeviceServices);
    }
  }, [devices]);

  // Request Bluetooth device (Web Bluetooth API or native mode)
  const handleScanDevice = async () => {
    // In native mode, backend automatically scans - just refresh the device list
    if (bluetoothMode === 'native') {
      await refetch();
      return;
    }

    // Web Bluetooth mode - use browser API
    if (!navigator.bluetooth) {
      alert('Web Bluetooth API is not available in this browser. Backend is in native mode - devices will appear automatically.');
      return;
    }

    try {
      setIsScanning(true);
      
      // Request device with common BLE service UUIDs
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'generic_access',
          'generic_attribute', 
          'device_information',
          'battery_service',
          // Standard BLE services
          '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
          '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
          '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
          '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
          // Ruuvi-specific services
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service
          '0000feaa-0000-1000-8000-00805f9b34fb', // Eddystone
          // Environmental Sensing
          '0000181a-0000-1000-8000-00805f9b34fb',
        ]
      });

      console.log('Selected device:', device);
      setBtDevice(device);

      // Register device with backend (basic info only)
      await fetch('/api/bluetooth/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: device.id,
          name: device.name || 'Unknown Device',
          services: []
        })
      });

      // Auto-connect and inspect after scanning
      try {
        const server = await device.gatt.connect();
        console.log('Auto-connected to GATT server:', server);
        
        // Update backend connection status
        await fetch(`/api/bluetooth/devices/${device.id}/connection`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connected: true })
        });
        
        // Auto-inspect to get capabilities (pass device with address matching btDevice)
        await inspectDeviceInternal(device);
      } catch (connectError) {
        console.error('Auto-connect failed:', connectError);
      }

      refetch();
      setIsScanning(false);
    } catch (error) {
      console.error('Bluetooth scan error:', error);
      setIsScanning(false);
    }
  };

  // Read a characteristic value
  const readCharacteristic = async (deviceAddress, serviceUuid, charUuid) => {
    try {
      if (!btDevice || !btDevice.gatt || !btDevice.gatt.connected) {
        alert('Device must be connected first');
        return;
      }

      const service = await btDevice.gatt.getPrimaryService(serviceUuid);
      const characteristic = await service.getCharacteristic(charUuid);
      const value = await characteristic.readValue();
      
      // Convert DataView to hex string
      const hexString = Array.from(new Uint8Array(value.buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      
      // Try to decode as UTF-8 string
      let textString = '';
      try {
        textString = new TextDecoder('utf-8').decode(value.buffer);
      } catch (e) {
        // Not valid UTF-8
      }
      
      const key = `${deviceAddress}:${serviceUuid}:${charUuid}`;
      setCharacteristicValues(prev => ({
        ...prev,
        [key]: {
          hex: hexString,
          text: textString,
          raw: value
        }
      }));
      
      console.log(`Read ${charUuid}: ${hexString} (${textString})`);
    } catch (error) {
      console.error('Error reading characteristic:', error);
      alert(`Failed to read: ${error.message}`);
    }
  };

  // Internal inspect function that works with Web Bluetooth device object
  const inspectDeviceInternal = async (webBluetoothDevice) => {
    try {
      if (!webBluetoothDevice || !webBluetoothDevice.gatt || !webBluetoothDevice.gatt.connected) {
        console.error('Device must be connected first.');
        alert('Device must be connected first.');
        return;
      }

      console.log('Starting device inspection...');
      const server = webBluetoothDevice.gatt;
      
      console.log('Getting primary services...');
      const services = await server.getPrimaryServices();
      console.log(`Found ${services.length} services:`, services.map(s => s.uuid));
      
      const serviceData = {};
      const capabilities = {};
      
      for (const service of services) {
        console.log(`Inspecting service: ${service.uuid}`);
        const characteristics = await service.getCharacteristics();
        console.log(`  Found ${characteristics.length} characteristics`);
        const charData = [];
        
        for (const char of characteristics) {
          // Convert properties object to plain object for serialization
          const props = {
            read: char.properties.read || false,
            write: char.properties.write || false,
            writeWithoutResponse: char.properties.writeWithoutResponse || false,
            notify: char.properties.notify || false,
            indicate: char.properties.indicate || false,
            authenticatedSignedWrites: char.properties.authenticatedSignedWrites || false,
            reliableWrite: char.properties.reliableWrite || false,
            writableAuxiliaries: char.properties.writableAuxiliaries || false
          };
          
          charData.push({
            uuid: char.uuid,
            properties: props
          });
          
          // Build capabilities map
          const key = `${service.uuid}:${char.uuid}`;
          capabilities[key] = {
            serviceUuid: service.uuid,
            characteristicUuid: char.uuid,
            properties: props
          };
        }
        
        serviceData[service.uuid] = {
          characteristics: charData
        };
      }
      
      const deviceAddress = webBluetoothDevice.id;
      const deviceName = webBluetoothDevice.name || 'Unknown Device';
      
      setDeviceServices(prev => ({
        ...prev,
        [deviceAddress]: serviceData
      }));
      
      // Update device with capabilities in backend
      await fetch('/api/bluetooth/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: deviceAddress,
          name: deviceName,
          services: Object.keys(serviceData),
          capabilities
        })
      });
      
      console.log('Device services:', serviceData);
      console.log('Device capabilities:', capabilities);
      console.log(`Successfully saved ${Object.keys(capabilities).length} capabilities to backend`);
    } catch (error) {
      console.error('Inspection error:', error);
      console.error('Error details:', error.stack);
      alert(`Failed to inspect device: ${error.message}. Check console for details.`);
    }
  };

  // Inspect device services and characteristics (wrapper for UI button)
  const inspectDevice = async (device) => {
    if (!btDevice || btDevice.id !== device.address) {
      alert('Please connect to this device first.');
      return;
    }
    await inspectDeviceInternal(btDevice);
  };

  // Connect to device
  const handleConnect = async (device) => {
    try {
      // Try to use existing btDevice or request new one
      let deviceToConnect = btDevice;
      
      if (!btDevice || btDevice.id !== device.address) {
        // Need to scan for device first
        if (!navigator.bluetooth) {
          alert('Web Bluetooth API is not available in this browser.');
          return;
        }
        
        try {
          deviceToConnect = await navigator.bluetooth.requestDevice({
            filters: [{ name: device.name }],
            optionalServices: [] // Allow all services
          });
          setBtDevice(deviceToConnect);
        } catch (scanError) {
          alert('Please use "Scan for Devices" button to select this device first.');
          return;
        }
      }

      const server = await deviceToConnect.gatt.connect();
      console.log('Connected to GATT server:', server);

      // Update backend
      await fetch(`/api/bluetooth/devices/${device.address}/connection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connected: true })
      });

      // Automatically inspect services to get capabilities
      await inspectDeviceInternal(deviceToConnect);

      refetch();
    } catch (error) {
      console.error('Connection error:', error);
      alert(`Failed to connect: ${error.message}`);
    }
  };

  // Disconnect from device
  const handleDisconnect = async (device) => {
    try {
      if (btDevice && btDevice.gatt.connected) {
        btDevice.gatt.disconnect();
      }

      // Update backend
      await fetch(`/api/bluetooth/devices/${device.address}/connection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connected: false })
      });

      refetch();
    } catch (error) {
      console.error('Disconnection error:', error);
    }
  };

  // Remove device
  const handleRemove = async (device) => {
    if (!confirm(`Remove device "${device.name}"?`)) return;

    try {
      await fetch(`/api/bluetooth/devices/${device.address}`, {
        method: 'DELETE'
      });
      refetch();
    } catch (error) {
      console.error('Remove error:', error);
    }
  };

  // Format last seen time
  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Never';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Bluetooth Monitor</h1>
          <p className="text-gray-400 mt-1">
            Discover and connect to Bluetooth devices
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScanDevice}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isScanning ? (
              <BluetoothSearching className="w-4 h-4 animate-pulse" />
            ) : (
              <Bluetooth className="w-4 h-4" />
            )}
            {isScanning ? 'Scanning...' : 'Scan for Devices'}
          </button>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Bluetooth className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-blue-300">
              {bluetoothMode === 'native' ? 'Native Bluetooth (BlueZ)' : 'Web Bluetooth API'}
            </div>
            <div className="text-xs text-blue-400 mt-1">
              {bluetoothMode === 'native' 
                ? 'Backend is scanning for Bluetooth devices automatically. Discovered devices will appear below.'
                : 'This page uses the Web Bluetooth API to discover and connect to Bluetooth devices directly from your browser. Requires Chrome, Edge, or Opera. Click "Scan for Devices" to start discovering nearby Bluetooth devices.'}
            </div>
            {bluetoothMode === 'native' && statusData && (
              <div className="text-xs text-gray-400 mt-2">
                Adapter: <span className="text-blue-400">{statusData.adapterState}</span> • 
                Scanning: <span className="text-blue-400">{statusData.isScanning ? 'Yes' : 'No'}</span> • 
                Devices: <span className="text-blue-400">{statusData.devicesDiscovered}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400">Total Devices</div>
          <div className="text-3xl font-bold text-white mt-2">{devices.length}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400">Connected</div>
          <div className="text-3xl font-bold text-green-500 mt-2">
            {devices.filter(d => d.connected).length}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400">Disconnected</div>
          <div className="text-3xl font-bold text-gray-500 mt-2">
            {devices.filter(d => !d.connected).length}
          </div>
        </div>
      </div>

      {/* Devices List */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Discovered Devices</h2>
        
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading devices...</div>
        ) : devices.length === 0 ? (
          <div className="text-center py-12">
            <BluetoothSearching className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No Bluetooth devices discovered yet.</p>
            <p className="text-sm text-gray-500 mt-2">Click "Scan for Devices" to start discovering.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <div 
                key={device.address} 
                className={`bg-gray-700 rounded-lg p-4 border-2 transition-all ${
                  device.connected 
                    ? 'border-green-500/50 shadow-lg shadow-green-500/10' 
                    : 'border-transparent hover:border-gray-600'
                }`}
              >
                {/* Device Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {device.connected ? (
                      <BluetoothConnected className="w-5 h-5 text-green-400" />
                    ) : (
                      <Bluetooth className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <div className="font-medium text-white">{device.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{device.address}</div>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    device.connected 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-gray-600/20 text-gray-400'
                  }`}>
                    {device.status}
                  </div>
                </div>

                {/* Device Info */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Last Seen:</span>
                    <span className="text-gray-300">{formatLastSeen(device.lastSeen)}</span>
                  </div>
                  {device.metadata?.services && device.metadata.services.length > 0 && (
                    <div className="text-gray-400">
                      <span>Services: </span>
                      <span className="text-gray-300">{device.metadata.services.length}</span>
                    </div>
                  )}
                </div>

                {/* Device Capabilities */}
                {deviceServices[device.address] && (
                  <div className="mt-3 p-3 bg-gray-800 rounded border border-gray-600">
                    <div className="text-xs font-semibold text-cyan-400 mb-2">GATT Services & Characteristics</div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {Object.entries(deviceServices[device.address]).map(([serviceUuid, serviceData]) => {
                        const serviceName = getUuidName(serviceUuid, 'service');
                        return (
                          <div key={serviceUuid} className="text-xs">
                            <div className="font-mono text-blue-400" title={serviceUuid}>
                              📡 {serviceName ? (
                                <span>
                                  <span className="font-semibold">{serviceName}</span>
                                  <span className="text-gray-500 ml-2 text-[10px]">{serviceUuid}</span>
                                </span>
                              ) : serviceUuid}
                            </div>
                            {serviceData.characteristics.map((char, idx) => {
                              const charName = getUuidName(char.uuid, 'characteristic');
                              return (
                                <div key={idx} className="ml-4 mt-1">
                                  <div className="font-mono text-gray-300" title={char.uuid}>
                                    ↳ {charName ? (
                                      <span>
                                        <span className="font-medium">{charName}</span>
                                        <span className="text-gray-500 ml-2 text-[10px]">{char.uuid}</span>
                                      </span>
                                    ) : char.uuid}
                                  </div>
                                  <div className="ml-4 flex items-center gap-2">
                                    <div className="text-gray-500 text-[10px]">
                                      {char.properties.read && '📖 Read '}
                                      {char.properties.write && '✏️ Write '}
                                      {char.properties.writeWithoutResponse && '📝 WriteNoResp '}
                                      {char.properties.notify && '🔔 Notify '}
                                      {char.properties.indicate && '📢 Indicate'}
                                    </div>
                                    {char.properties.read && (
                                      <button
                                        onClick={() => readCharacteristic(device.address, serviceUuid, char.uuid)}
                                        className="text-[10px] px-2 py-0.5 bg-blue-600 hover:bg-blue-700 rounded text-white"
                                      >
                                        Read Value
                                      </button>
                                    )}
                                  </div>
                                  {(() => {
                                    const valueKey = `${device.address}:${serviceUuid}:${char.uuid}`;
                                    const value = characteristicValues[valueKey];
                                    return value && (
                                      <div className="ml-4 mt-1 text-[10px] space-y-1">
                                        {value.text && value.text.match(/^[\x20-\x7E]+$/) && (
                                          <div className="text-green-400">📝 Text: {value.text}</div>
                                        )}
                                        <div className="text-gray-400 font-mono">🔢 Hex: {value.hex}</div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  {device.connected ? (
                    <button
                      onClick={() => handleDisconnect(device)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                    >
                      <Unlink className="w-4 h-4" />
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(device)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                    >
                      <Link className="w-4 h-4" />
                      Connect
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(device)}
                    className="px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors"
                    title="Remove device"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BluetoothMonitor;
