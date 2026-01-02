import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Radio, 
  Camera, 
  Wifi, 
  RefreshCw, 
  Edit2, 
  Check, 
  X, 
  Trash2,
  Clock
} from 'lucide-react';

const Devices = () => {
  const queryClient = useQueryClient();
  const [editingDevice, setEditingDevice] = useState(null);
  const [newName, setNewName] = useState('');

  // Fetch all devices
  const { data: devicesData, isLoading, error, refetch } = useQuery({
    queryKey: ['all-devices'],
    queryFn: async () => {
      console.log('Fetching devices from /api/devices');
      const response = await fetch('/api/devices');
      if (!response.ok) throw new Error('Failed to fetch devices');
      const data = await response.json();
      console.log('Devices received:', data);
      return data;
    },
    refetchInterval: 5000,
  });

  // Update device name mutation
  const updateNameMutation = useMutation({
    mutationFn: async ({ type, address, name }) => {
      const response = await fetch(`/api/devices/${type}/${address}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error('Failed to update device name');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['all-devices']);
      setEditingDevice(null);
      setNewName('');
    },
  });

  // Delete device mutation
  const deleteDeviceMutation = useMutation({
    mutationFn: async ({ type, address }) => {
      const response = await fetch(`/api/devices/${type}/${address}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete device');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['all-devices']);
    },
  });

  const devices = devicesData?.devices || [];
  const stats = devicesData?.byType || {};

  const getDeviceIcon = (type) => {
    switch (type) {
      case 'xbee':
        return <Radio className="w-5 h-5 text-yellow-500" />;
      case 'bluetooth':
        return <Wifi className="w-5 h-5 text-cyan-500" />;
      case 'zigbee':
        return <Wifi className="w-5 h-5 text-blue-500" />;
      case 'camera':
        return <Camera className="w-5 h-5 text-purple-500" />;
      default:
        return <Radio className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'xbee':
        return 'XBee';
      case 'bluetooth':
        return 'Bluetooth';
      case 'zigbee':
        return 'Zigbee';
      case 'camera':
        return 'Camera';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'xbee':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
      case 'bluetooth':
        return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30';
      case 'zigbee':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
      case 'camera':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/30';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/30';
    }
  };

  const startEditing = (device) => {
    setEditingDevice(device.id);
    setNewName(device.name);
  };

  const cancelEditing = () => {
    setEditingDevice(null);
    setNewName('');
  };

  const saveDeviceName = (device) => {
    if (newName.trim()) {
      updateNameMutation.mutate({
        type: device.type,
        address: device.address,
        name: newName.trim(),
      });
    }
  };

  const deleteDevice = (device) => {
    if (confirm(`Are you sure you want to remove ${device.name}?`)) {
      deleteDeviceMutation.mutate({
        type: device.type,
        address: device.address,
      });
    }
  };

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
          <h1 className="text-2xl font-bold text-white">All Devices</h1>
          <p className="text-gray-400 mt-1">
            Manage all devices across your automation system
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400">Total Devices</div>
          <div className="text-3xl font-bold text-white mt-2">{devices.length}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400">XBee Devices</div>
          <div className="text-3xl font-bold text-yellow-500 mt-2">{stats.xbee || 0}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400">Bluetooth</div>
          <div className="text-3xl font-bold text-cyan-500 mt-2">{stats.bluetooth || 0}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400">Zigbee Devices</div>
          <div className="text-3xl font-bold text-blue-500 mt-2">{stats.zigbee || 0}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400">Cameras</div>
          <div className="text-3xl font-bold text-purple-500 mt-2">{stats.camera || 0}</div>
        </div>
      </div>

      {/* Devices List */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Devices</h2>
        
        {error ? (
          <div className="text-center py-8">
            <div className="text-red-500 mb-2">Error loading devices</div>
            <div className="text-gray-400 text-sm">{error.message}</div>
          </div>
        ) : isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading devices...</div>
        ) : devices.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No devices found. Devices will appear here once they're discovered.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <div key={device.id} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-650 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getDeviceIcon(device.type)}
                    <div className="flex-1">
                      {editingDevice === device.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="bg-gray-600 text-white px-2 py-1 rounded text-sm flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveDeviceName(device);
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          />
                          <button
                            onClick={() => saveDeviceName(device)}
                            className="p-1 hover:bg-green-600 rounded transition-colors"
                          >
                            <Check className="w-4 h-4 text-green-400" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 hover:bg-red-600 rounded transition-colors"
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{device.name}</h3>
                          <button
                            onClick={() => startEditing(device)}
                            className="p-1 hover:bg-gray-600 rounded transition-colors"
                          >
                            <Edit2 className="w-3 h-3 text-gray-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs border ${getTypeColor(device.type)}`}>
                    {getTypeLabel(device.type)}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Address:</span>
                    <span className="text-white font-mono text-xs">{device.address.slice(-12)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                      <span className="text-white capitalize">{device.status}</span>
                    </span>
                  </div>
                  {device.lastSeen && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Last Seen:</span>
                      <span className="text-white flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatLastSeen(device.lastSeen)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-600 flex justify-end">
                  <button
                    onClick={() => deleteDevice(device)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
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

export default Devices;
