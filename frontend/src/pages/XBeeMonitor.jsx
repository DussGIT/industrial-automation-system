import { useState, useEffect, useRef } from 'react';
import { Radio, Wifi, WifiOff, Trash2, Play, RefreshCw } from 'lucide-react';
import { io } from 'socket.io-client';

export default function XBeeMonitor() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(null);
  const [devices, setDevices] = useState([]);
  const [traffic, setTraffic] = useState(() => {
    // Load traffic from localStorage on mount
    try {
      const saved = localStorage.getItem('xbee-traffic');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [autoScroll, setAutoScroll] = useState(true);
  const trafficEndRef = useRef(null);
  const socketRef = useRef(null);

  // Save traffic to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('xbee-traffic', JSON.stringify(traffic.slice(-100)));
    } catch (error) {
      console.error('Error saving traffic to localStorage:', error);
    }
  }, [traffic]);

  useEffect(() => {
    // Fetch initial status
    fetchStatus();

    // Connect to WebSocket (use relative path for proxy)
    socketRef.current = io();

    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    socketRef.current.on('xbee:data', (packet) => {
      console.log('XBee data received:', packet);
      try {
        const entry = {
          id: Date.now() + Math.random(),
          type: 'data',
          timestamp: packet?.timestamp || new Date().toISOString(),
          address64: packet?.address64 || 'Unknown',
          address16: packet?.address16 || 'Unknown',
          data: packet?.data || [],
          payload: packet?.payload || '',
          payloadHex: packet?.payloadHex || null,
          payloadBytes: packet?.payloadBytes || null,
          payloadLength: packet?.payloadLength || 0,
          isPrintable: packet?.isPrintable || false,
          rssi: packet?.rssi || null,
          options: packet?.options || null
        };
        
        setTraffic(prev => [...prev.slice(-99), entry]); // Keep last 100 entries
      } catch (error) {
        console.error('Error processing XBee data:', error, packet);
      }
    });

    socketRef.current.on('xbee:device-discovered', (device) => {
      console.log('XBee device discovered:', device);
      try {
        const entry = {
          id: Date.now() + Math.random(),
          type: 'device-discovered',
          timestamp: new Date().toISOString(),
          device: device || {}
        };
        
        setTraffic(prev => [...prev.slice(-99), entry]);
        
        if (device?.address64) {
          setDevices(prev => {
            const existing = prev.find(d => d?.address64 === device.address64);
            if (existing) {
              return prev.map(d => d?.address64 === device.address64 ? device : d);
            }
            return [...prev, device];
          });
        }
      } catch (error) {
        console.error('Error processing device discovery:', error, device);
      }
    });

    socketRef.current.on('xbee:transmit-status', (statusData) => {
      const entry = {
        id: Date.now() + Math.random(),
        type: 'transmit-status',
        timestamp: new Date().toISOString(),
        ...statusData
      };
      
      setTraffic(prev => [...prev.slice(-99), entry]);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (autoScroll && trafficEndRef.current) {
      trafficEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [traffic, autoScroll]);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/xbee/status');
      const data = await response.json();
      setStatus(data);
      setConnected(data.connected);
      setDevices(data.devices || []);
    } catch (error) {
      console.error('Error fetching XBee status:', error);
      setConnected(false);
    }
  };

  const handleDiscover = async () => {
    try {
      await fetch('/api/xbee/discover', {
        method: 'POST'
      });
    } catch (error) {
      console.error('Error starting discovery:', error);
    localStorage.removeItem('xbee-traffic');
    }
  };

  const clearTraffic = () => {
    setTraffic([]);
  };

  const formatData = (data) => {
    try {
      if (!data) return 'N/A';
      
      if (typeof data === 'string') {
        return data;
      }
      
      if (Array.isArray(data)) {
        if (data.length === 0) return 'Empty';
        return data.map(b => {
          const byte = typeof b === 'number' ? b : parseInt(b);
          return byte.toString(16).padStart(2, '0').toUpperCase();
        }).join(' ');
      }
      
      if (data.type === 'Buffer' && Array.isArray(data.data)) {
        return formatData(data.data);
      }
      
      if (typeof data === 'object') {
        return JSON.stringify(data);
      }
      
      return String(data);
    } catch (error) {
      console.error('Error formatting data:', error, data);
      return 'Error formatting data';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">XBee Monitor</h1>
        <p className="text-gray-400">Real-time XBee network traffic and device monitoring</p>
      </div>

      {/* Status Card */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Connection Status</h2>
          {connected ? (
            <div className="flex items-center gap-2 text-green-500">
              <Wifi className="w-5 h-5" />
              <span>Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-500">
              <WifiOff className="w-5 h-5" />
              <span>Disconnected</span>
            </div>
          )}
        </div>
        
        {status && (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Port:</span>
              <span className="ml-2 font-mono">{status.port}</span>
            </div>
            <div>
              <span className="text-gray-400">Baud Rate:</span>
              <span className="ml-2 font-mono">{status.baudRate}</span>
            </div>
            <div>
              <span className="text-gray-400">Devices:</span>
              <span className="ml-2 font-mono">{devices.length}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={fetchStatus}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleDiscover}
            disabled={!connected}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            Discover Network
          </button>
        </div>
      </div>

      {/* Devices */}
      {devices.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Discovered Devices</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <div key={device.address64} className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Radio className="w-5 h-5 text-yellow-500" />
                  <span className="font-semibold">{device.name || 'Unknown'}</span>
                </div>
                <div className="text-sm space-y-1">
                  <div className="font-mono text-gray-400">
                    64-bit: {device.address64}
                  </div>
                  {device.address16 && (
                    <div className="font-mono text-gray-400">
                      16-bit: {device.address16}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Last seen: {new Date(device.lastSeen).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Traffic Monitor */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Live Traffic</h2>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              Auto-scroll
            </label>
            <button
              onClick={clearTraffic}
              className="flex items-center gap-2 px-3 py-1 bg-red-600 hover:bg-red-700 rounded-lg transition text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>

        <div className="bg-black rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
          {traffic.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No traffic yet. Waiting for XBee data...
            </div>
          ) : (
            <div className="space-y-2">
              {traffic.map((entry) => (
                <div key={entry.id} className="border-b border-gray-800 pb-2">
                  <div className="flex items-start gap-3">
                    <span className="text-gray-500 text-xs shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    
                    {entry.type === 'data' && (
                      <div className="flex-1">
                        <div className="text-blue-400 mb-1">
                          ← Received from {entry.address64 || 'Unknown'} ({entry.address16 || 'N/A'})
                        </div>
                        
                        {/* Show hex format with Florlink message ID if present */}
                        {entry.payloadHex && (
                          <div className="text-green-400 mb-1">
                            HEX: {entry.payloadHex}
                            {entry.payloadBytes && entry.payloadBytes.length > 0 && (
                              <span className="ml-2 text-yellow-300">
                                (MsgID: 0x{entry.payloadBytes[0].toString(16).padStart(2, '0').toUpperCase()})
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Show byte array */}
                        {entry.payloadBytes && entry.payloadBytes.length > 0 && (
                          <div className="text-yellow-400 mb-1">
                            Bytes: [{entry.payloadBytes.join(', ')}]
                          </div>
                        )}
                        
                        {/* Show ASCII if printable */}
                        {entry.isPrintable && entry.payload && (
                          <div className="text-cyan-400 mb-1">
                            ASCII: "{entry.payload}"
                          </div>
                        )}
                        
                        <div className="text-gray-500 text-xs mt-1">
                          Length: {entry.payloadLength} bytes
                          {entry.options && ` | Options: ${entry.options}`}
                          {entry.rssi !== null && entry.rssi !== undefined && ` | RSSI: ${entry.rssi} dBm`}
                        </div>
                      </div>
                    )}
                    
                    {entry.type === 'device-discovered' && entry.device && (
                      <div className="flex-1">
                        <div className="text-purple-400">
                          🔍 Device Discovered: {entry.device.address64 || 'Unknown'}
                        </div>
                        {entry.device.name && (
                          <div className="text-gray-400">
                            Name: {entry.device.name}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {entry.type === 'transmit-status' && (
                      <div className="flex-1">
                        <div className={entry.success ? 'text-green-400' : 'text-red-400'}>
                          → Transmit {entry.success ? 'Success' : 'Failed'}
                        </div>
                        <div className="text-gray-400">
                          Frame ID: {entry.frameId}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={trafficEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
