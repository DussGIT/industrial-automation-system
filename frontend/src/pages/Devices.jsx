import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Lightbulb, 
  Power, 
  Trash2, 
  RefreshCw, 
  Plus, 
  Radio,
  Thermometer,
  Activity,
  Zap,
  Sun,
  AlertCircle,
  Check,
  X
} from 'lucide-react';

const Devices = () => {
  const queryClient = useQueryClient();
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [commandValue, setCommandValue] = useState('');
  const [permitJoinDuration, setPermitJoinDuration] = useState(60);
  const [showPermitJoin, setShowPermitJoin] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Fetch Zigbee network status
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['zigbee-status'],
    queryFn: async () => {
      const response = await fetch('/api/zigbee/status');
      if (!response.ok) throw new Error('Failed to fetch Zigbee status');
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch all Zigbee devices
  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['zigbee-devices'],
    queryFn: async () => {
      const response = await fetch('/api/zigbee/devices');
      if (!response.ok) throw new Error('Failed to fetch Zigbee devices');
      return response.json();
    },
    refetchInterval: 5000,
  });

  // Send command mutation
  const sendCommandMutation = useMutation({
    mutationFn: async ({ deviceName, command, value }) => {
      const response = await fetch(`/api/zigbee/devices/${encodeURIComponent(deviceName)}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, value }),
      });
      if (!response.ok) throw new Error('Failed to send command');
      return response.json();
    },
    onSuccess: (data) => {
      setTestResult({ success: true, message: 'Command sent successfully!' });
      queryClient.invalidateQueries(['zigbee-devices']);
      setTimeout(() => setTestResult(null), 3000);
    },
    onError: (error) => {
      setTestResult({ success: false, message: error.message });
      setTimeout(() => setTestResult(null), 3000);
    },
  });

  // Permit join mutation
  const permitJoinMutation = useMutation({
    mutationFn: async (duration) => {
      const response = await fetch('/api/zigbee/permit-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration }),
      });
      if (!response.ok) throw new Error('Failed to enable permit join');
      return response.json();
    },
    onSuccess: () => {
      setShowPermitJoin(false);
      queryClient.invalidateQueries(['zigbee-status']);
    },
  });

  // Remove device mutation
  const removeDeviceMutation = useMutation({
    mutationFn: async (deviceName) => {
      const response = await fetch(`/api/zigbee/devices/${encodeURIComponent(deviceName)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove device');
      return response.json();
    },
    onSuccess: () => {
      setSelectedDevice(null);
      queryClient.invalidateQueries(['zigbee-devices']);
    },
  });

  const devices = devicesData?.devices || [];
  const status = statusData?.status || {};

  // Get device icon based on type
  const getDeviceIcon = (device) => {
    const type = device.type?.toLowerCase() || '';
    const definition = device.definition?.description?.toLowerCase() || '';
    
    if (type.includes('light') || definition.includes('light') || definition.includes('bulb')) {
      return <Lightbulb className="w-5 h-5" />;
    }
    if (type.includes('switch') || definition.includes('switch')) {
      return <Power className="w-5 h-5" />;
    }
    if (type.includes('sensor') || definition.includes('sensor')) {
      return <Activity className="w-5 h-5" />;
    }
    if (type.includes('temperature') || definition.includes('temperature')) {
      return <Thermometer className="w-5 h-5" />;
    }
    return <Zap className="w-5 h-5" />;
  };

  // Get device capabilities
  const getDeviceCapabilities = (device) => {
    const exposes = device.definition?.exposes || [];
    const capabilities = new Set();
    
    exposes.forEach(expose => {
      if (expose.features) {
        expose.features.forEach(feature => {
          capabilities.add(feature.name);
        });
      } else if (expose.name) {
        capabilities.add(expose.name);
      }
    });
    
    return Array.from(capabilities);
  };

  const handleTestCommand = (device, command, value) => {
    sendCommandMutation.mutate({
      deviceName: device.friendly_name,
      command,
      value,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Zigbee Devices</h1>
          <p className="text-gray-400 mt-1">
            Manage and control your Zigbee network
          </p>
        </div>
        <button
          onClick={() => setShowPermitJoin(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Pair New Device
        </button>
      </div>

      {/* Network Status */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Radio className="w-5 h-5" />
          Network Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400">Coordinator</div>
            <div className="text-lg font-semibold text-white mt-1">
              {status.permitJoin !== undefined ? (
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Online
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                  Unknown
                </span>
              )}
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400">Total Devices</div>
            <div className="text-2xl font-bold text-white mt-1">
              {devices.length}
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400">Permit Join</div>
            <div className="text-lg font-semibold mt-1">
              {status.permitJoin ? (
                <span className="text-green-400">Enabled</span>
              ) : (
                <span className="text-gray-400">Disabled</span>
              )}
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400">Last Update</div>
            <div className="text-sm text-white mt-1">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Test Result Alert */}
      {testResult && (
        <div className={`rounded-lg p-4 flex items-center gap-3 ${
          testResult.success ? 'bg-green-900/30 border border-green-500' : 'bg-red-900/30 border border-red-500'
        }`}>
          {testResult.success ? (
            <Check className="w-5 h-5 text-green-400" />
          ) : (
            <X className="w-5 h-5 text-red-400" />
          )}
          <span className={testResult.success ? 'text-green-300' : 'text-red-300'}>
            {testResult.message}
          </span>
        </div>
      )}

      {/* Devices List */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Devices</h2>
        
        {devicesLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
            <p className="text-gray-400">Loading devices...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-400">No devices found</p>
            <p className="text-sm text-gray-500 mt-1">
              Click "Pair New Device" to add your first device
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <div
                key={device.ieee_address}
                className="bg-gray-700 rounded-lg p-4 hover:bg-gray-650 transition-colors cursor-pointer"
                onClick={() => setSelectedDevice(device)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-600 rounded-lg text-blue-400">
                      {getDeviceIcon(device)}
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {device.friendly_name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {device.definition?.model || 'Unknown Model'}
                      </div>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${
                    device.supported ? 'bg-green-500' : 'bg-gray-500'
                  }`}></div>
                </div>

                {/* Device State */}
                {device.state && (
                  <div className="space-y-1 mb-3">
                    {device.state.state && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Status:</span>
                        <span className={`font-semibold ${
                          device.state.state === 'ON' ? 'text-green-400' : 'text-gray-400'
                        }`}>
                          {device.state.state}
                        </span>
                      </div>
                    )}
                    {device.state.brightness !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Brightness:</span>
                        <span className="text-white">{device.state.brightness}</span>
                      </div>
                    )}
                    {device.state.temperature !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Temperature:</span>
                        <span className="text-white">{device.state.temperature}°C</span>
                      </div>
                    )}
                    {device.state.linkquality !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Signal:</span>
                        <span className="text-white">{device.state.linkquality}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                {device.supported && getDeviceCapabilities(device).includes('state') && (
                  <div className="flex gap-2 pt-3 border-t border-gray-600">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTestCommand(device, 'state', 'ON');
                      }}
                      className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                      disabled={sendCommandMutation.isPending}
                    >
                      On
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTestCommand(device, 'state', 'OFF');
                      }}
                      className="flex-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors"
                      disabled={sendCommandMutation.isPending}
                    >
                      Off
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Device Details Modal */}
      {selectedDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gray-700 rounded-lg text-blue-400">
                  {getDeviceIcon(selectedDevice)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {selectedDevice.friendly_name}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {selectedDevice.definition?.vendor} - {selectedDevice.definition?.model}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDevice(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Device Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Device Information</h3>
                <div className="bg-gray-700 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">IEEE Address:</span>
                    <span className="text-white font-mono">{selectedDevice.ieee_address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Network Address:</span>
                    <span className="text-white font-mono">{selectedDevice.network_address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Type:</span>
                    <span className="text-white">{selectedDevice.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Supported:</span>
                    <span className={selectedDevice.supported ? 'text-green-400' : 'text-red-400'}>
                      {selectedDevice.supported ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {selectedDevice.definition?.description && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Description:</span>
                      <span className="text-white">{selectedDevice.definition.description}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Capabilities */}
              {selectedDevice.supported && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Capabilities</h3>
                  <div className="flex flex-wrap gap-2">
                    {getDeviceCapabilities(selectedDevice).map((capability) => (
                      <span
                        key={capability}
                        className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full text-sm"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Test Commands */}
              {selectedDevice.supported && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Test Commands</h3>
                  <div className="space-y-3">
                    {getDeviceCapabilities(selectedDevice).includes('state') && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTestCommand(selectedDevice, 'state', 'ON')}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                          disabled={sendCommandMutation.isPending}
                        >
                          Turn On
                        </button>
                        <button
                          onClick={() => handleTestCommand(selectedDevice, 'state', 'OFF')}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
                          disabled={sendCommandMutation.isPending}
                        >
                          Turn Off
                        </button>
                        <button
                          onClick={() => handleTestCommand(selectedDevice, 'state', 'TOGGLE')}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          disabled={sendCommandMutation.isPending}
                        >
                          Toggle
                        </button>
                      </div>
                    )}
                    {getDeviceCapabilities(selectedDevice).includes('brightness') && (
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Brightness (0-255)</label>
                        <div className="flex gap-2">
                          <input
                            type="range"
                            min="0"
                            max="255"
                            value={commandValue || 128}
                            onChange={(e) => setCommandValue(e.target.value)}
                            className="flex-1"
                          />
                          <button
                            onClick={() => handleTestCommand(selectedDevice, 'brightness', parseInt(commandValue || 128))}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                            disabled={sendCommandMutation.isPending}
                          >
                            Set ({commandValue || 128})
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Remove Device */}
              <div className="pt-4 border-t border-gray-700">
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to remove ${selectedDevice.friendly_name}?`)) {
                      removeDeviceMutation.mutate(selectedDevice.friendly_name);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white"
                  disabled={removeDeviceMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Device
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permit Join Modal */}
      {showPermitJoin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-white">Pair New Device</h2>
              <button
                onClick={() => setShowPermitJoin(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-300">
                Enable pairing mode to add new Zigbee devices to your network. Put your device into pairing mode (usually by pressing and holding a button).
              </p>

              <div>
                <label className="block text-sm font-medium mb-2">Duration (seconds)</label>
                <input
                  type="number"
                  value={permitJoinDuration}
                  onChange={(e) => setPermitJoinDuration(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="10"
                  max="254"
                />
                <p className="text-xs text-gray-400 mt-1">
                  How long pairing mode should remain active (10-254 seconds)
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => permitJoinMutation.mutate(permitJoinDuration)}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  disabled={permitJoinMutation.isPending}
                >
                  {permitJoinMutation.isPending ? 'Enabling...' : 'Enable Pairing'}
                </button>
                <button
                  onClick={() => setShowPermitJoin(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Devices;
