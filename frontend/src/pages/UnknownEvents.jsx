import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, X, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';

const UnknownEvents = () => {
  const queryClient = useQueryClient();
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [mappingEvent, setMappingEvent] = useState(null);

  // Fetch unknown events
  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['unknown-events'],
    queryFn: async () => {
      const response = await fetch('/api/events/unknown?status=pending');
      if (!response.ok) throw new Error('Failed to fetch unknown events');
      return response.json();
    },
    refetchInterval: 5000
  });

  // Ignore event mutation
  const ignoreMutation = useMutation({
    mutationFn: async ({ id, notes }) => {
      const response = await fetch(`/api/events/unknown/${id}/ignore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      if (!response.ok) throw new Error('Failed to ignore event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['unknown-events']);
    }
  });

  const events = eventsData?.events || [];

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Unknown Events</h1>
        <p className="text-gray-400">
          Events received from devices that need mapping to event types
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
          <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">All Clear!</h3>
          <p className="text-gray-400">No unknown events pending mapping</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"
            >
              {/* Event Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <AlertCircle className="w-6 h-6 text-yellow-500" />
                  <div>
                    <h3 className="font-semibold text-white">{event.device_name}</h3>
                    <p className="text-sm text-gray-400">
                      Signature: <span className="font-mono">{event.event_signature}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Occurrences</p>
                    <p className="text-lg font-semibold text-white">{event.occurrence_count}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-400">Last Seen</p>
                    <p className="text-sm text-white">{formatDate(event.last_seen)}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      title="View Details"
                    >
                      {expandedEvent === event.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedEvent === event.id && (
                <div className="border-t border-gray-700 p-4 bg-gray-900">
                  <h4 className="font-semibold text-white mb-3">Raw Payload:</h4>
                  <pre className="bg-black/30 p-4 rounded-lg overflow-x-auto text-sm text-gray-300 font-mono">
                    {JSON.stringify(event.raw_payload, null, 2)}
                  </pre>

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setMappingEvent(event)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      Define Mapping
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to ignore this event?')) {
                          ignoreMutation.mutate({ id: event.id, notes: 'User ignored' });
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                      disabled={ignoreMutation.isPending}
                    >
                      <X className="w-4 h-4" />
                      Ignore
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mapping Modal */}
      {mappingEvent && (
        <MappingModal
          event={mappingEvent}
          onClose={() => setMappingEvent(null)}
          onSuccess={() => {
            setMappingEvent(null);
            queryClient.invalidateQueries(['unknown-events']);
          }}
        />
      )}
    </div>
  );
};

// Mapping Modal Component
const MappingModal = ({ event, onClose, onSuccess }) => {
  const [eventType, setEventType] = useState('motion');
  const [fieldMappings, setFieldMappings] = useState({});

  const defineMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`/api/events/unknown/${event.id}/define`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to define mapping');
      return response.json();
    },
    onSuccess
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    defineMutation.mutate({ eventType, fieldMappings });
  };

  const eventTypes = [
    { value: 'motion', label: 'Motion Detection' },
    { value: 'dwelling', label: 'Dwelling/Loitering' },
    { value: 'lineCrossing', label: 'Line Crossing' },
    { value: 'intrusion', label: 'Intrusion Detection' },
    { value: 'faceDetection', label: 'Face Detection' },
    { value: 'tamper', label: 'Tampering' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Define Event Mapping</h2>
          <p className="text-gray-400 mt-1">Map this unknown event to a known event type</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Event Type
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              required
            >
              {eventTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Event Payload (for reference)
            </label>
            <pre className="bg-black/30 p-4 rounded-lg overflow-x-auto text-xs text-gray-300 font-mono max-h-60">
              {JSON.stringify(event.raw_payload, null, 2)}
            </pre>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              <strong>Note:</strong> This will update the device definition to automatically recognize
              this event type in the future. Advanced field mapping can be configured later in the
              device definition editor.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={defineMutation.isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {defineMutation.isPending ? 'Saving...' : 'Save Mapping'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UnknownEvents;
