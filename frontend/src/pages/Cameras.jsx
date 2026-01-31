import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Plus, Settings, Trash2, Activity, AlertCircle, CheckCircle, Clock, WifiOff } from 'lucide-react';

const Cameras = () => {
  const queryClient = useQueryClient();
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [showSetupInstructions, setShowSetupInstructions] = useState(false);

  // Fetch camera instances
  const { data: camerasData, isLoading: camerasLoading } = useQuery({
    queryKey: ['camera-instances'],
    queryFn: async () => {
      const response = await fetch('/api/device-instances?device_type=camera');
      if (!response.ok) throw new Error('Failed to fetch cameras');
      return response.json();
    },
    refetchInterval: 5000
  });

  // Fetch device definitions
  const { data: definitionsData } = useQuery({
    queryKey: ['camera-definitions'],
    queryFn: async () => {
      const response = await fetch('/api/device-definitions?device_type=camera');
      if (!response.ok) throw new Error('Failed to fetch definitions');
      return response.json();
    }
  });

  // Fetch unknown events count
  const { data: unknownEventsData } = useQuery({
    queryKey: ['unknown-events-count'],
    queryFn: async () => {
      const response = await fetch('/api/events/unknown?status=pending');
      if (!response.ok) throw new Error('Failed to fetch unknown events');
      return response.json();
    },
    refetchInterval: 10000
  });

  const cameras = camerasData?.instances || [];
  const definitions = definitionsData?.definitions || [];
  const unknownEventsCount = unknownEventsData?.events?.length || 0;

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'text-green-400 bg-green-500/10';
      case 'offline': return 'text-gray-400 bg-gray-500/10';
      default: return 'text-yellow-400 bg-yellow-500/10';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online': return <CheckCircle className="w-4 h-4" />;
      case 'offline': return <WifiOff className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Cameras</h1>
          <p className="text-gray-400">Manage IP cameras and event monitoring</p>
        </div>
        <div className="flex gap-3">
          {unknownEventsCount > 0 && (
            <button
              onClick={() => window.location.href = '/unknown-events'}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
            >
              <AlertCircle className="w-5 h-5" />
              {unknownEventsCount} Unknown Event{unknownEventsCount !== 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={() => setShowAddCamera(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Camera
          </button>
        </div>
      </div>

      {/* Camera Grid */}
      {camerasLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading cameras...</p>
        </div>
      ) : cameras.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
          <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Cameras Configured</h3>
          <p className="text-gray-400 mb-6">Add your first IP camera to start monitoring events</p>
          <button
            onClick={() => setShowAddCamera(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Add Camera
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((camera) => (
            <div
              key={camera.id}
              className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-blue-500 transition-colors cursor-pointer"
              onClick={() => setSelectedCamera(camera)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Camera className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{camera.name}</h3>
                    <p className="text-sm text-gray-400">{camera.manufacturer} {camera.model}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusColor(camera.status)}`}>
                  {getStatusIcon(camera.status)}
                  <span>{camera.status}</span>
                </div>
              </div>

              {camera.ip_address && (
                <div className="text-sm text-gray-400 mb-2">
                  <span className="font-mono">{camera.ip_address}</span>
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-700">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatLastSeen(camera.last_seen)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Camera Modal */}
      {showAddCamera && (
        <AddCameraModal
          definitions={definitions}
          onClose={() => setShowAddCamera(false)}
          onSuccess={() => {
            setShowAddCamera(false);
            queryClient.invalidateQueries(['camera-instances']);
          }}
        />
      )}

      {/* Camera Details Modal */}
      {selectedCamera && (
        <CameraDetailsModal
          camera={selectedCamera}
          definitions={definitions}
          onClose={() => setSelectedCamera(null)}
          onShowSetup={() => {
            setShowSetupInstructions(selectedCamera);
            setSelectedCamera(null);
          }}
        />
      )}

      {/* Setup Instructions Modal */}
      {showSetupInstructions && (
        <SetupInstructionsModal
          camera={showSetupInstructions}
          definitions={definitions}
          onClose={() => setShowSetupInstructions(null)}
        />
      )}
    </div>
  );
};

// Add Camera Modal Component
const AddCameraModal = ({ definitions, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [selectedDefinition, setSelectedDefinition] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    port: 80,
    username: 'root',
    password: ''
  });

  const registerMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch('/api/device-instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to register camera');
      return response.json();
    },
    onSuccess: onSuccess
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    registerMutation.mutate({
      name: formData.name,
      deviceType: 'camera',
      definitionId: selectedDefinition?.id,
      ipAddress: formData.ipAddress,
      config: {
        port: formData.port,
        username: formData.username,
        password: formData.password
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Add Camera</h2>
          <p className="text-gray-400 mt-1">Step {step} of 2</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white mb-4">Select Camera Model</h3>
              <div className="grid gap-3">
                {definitions.map((def) => (
                  <div
                    key={def.id}
                    onClick={() => {
                      setSelectedDefinition(def.definition);
                      setStep(2);
                    }}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedDefinition?.id === def.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Camera className="w-8 h-8 text-purple-400" />
                      <div>
                        <h4 className="font-semibold text-white">
                          {def.manufacturer} {def.model}
                        </h4>
                        <p className="text-sm text-gray-400">{def.definition.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white mb-4">Camera Configuration</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Camera Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Front Entrance"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  IP Address
                </label>
                <input
                  type="text"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono"
                  placeholder="192.168.1.100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Port
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  required
                />
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6 pt-6 border-t border-gray-700">
            <button
              type="button"
              onClick={() => step === 1 ? onClose() : setStep(1)}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            {step === 2 && (
              <button
                type="submit"
                disabled={registerMutation.isPending}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {registerMutation.isPending ? 'Registering...' : 'Register Camera'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

// Camera Details Modal (placeholder for now)
const CameraDetailsModal = ({ camera, onClose, onShowSetup }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">{camera.name}</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Model:</span>
              <span className="text-white">{camera.manufacturer} {camera.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">IP Address:</span>
              <span className="text-white font-mono">{camera.ip_address}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className="text-white">{camera.status}</span>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onShowSetup}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Setup Instructions
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Setup Instructions Modal (placeholder for now)
const SetupInstructionsModal = ({ camera, definitions, onClose }) => {
  const definition = definitions.find(d => d.id === camera.definition_id);
  const instructions = definition?.definition?.setupInstructions;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">Setup Instructions</h2>
          <div className="prose prose-invert max-w-none">
            {instructions?.steps?.map((step) => (
              <div key={step.step} className="mb-6">
                <h3 className="text-lg font-semibold text-white">
                  {step.step}. {step.title}
                </h3>
                <p className="text-gray-300">{step.description}</p>
                {step.details && (
                  <div className="text-sm text-gray-400 mt-2">
                    {Array.isArray(step.details) ? (
                      <ul className="list-disc list-inside">
                        {step.details.map((detail, i) => (
                          <li key={i}>{detail}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{step.details}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="mt-6 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cameras;
