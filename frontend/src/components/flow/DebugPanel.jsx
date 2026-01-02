import { useState, useEffect } from 'react';
import { X, Trash2, Terminal } from 'lucide-react';
import { io } from 'socket.io-client';

export default function DebugPanel({ flowId }) {
  const [messages, setMessages] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Connect to WebSocket
    const socket = io();

    socket.on('connect', () => {
      console.log('WebSocket connected for debug panel');
    });

    socket.on('debug:message', (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          timestamp: new Date(data.timestamp),
          nodeId: data.nodeId,
          nodeName: data.nodeName,
          message: data.message,
        },
      ]);
      // Auto-open panel when message received
      setIsOpen(true);
    });

    socket.on('flow:node-output', (data) => {
      if (data.flowId === flowId) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            timestamp: new Date(data.timestamp),
            nodeId: data.nodeId,
            type: 'output',
            message: data.data,
          },
        ]);
      }
    });

    socket.on('flow:node-error', (data) => {
      if (data.flowId === flowId) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            timestamp: new Date(data.timestamp),
            nodeId: data.nodeId,
            type: 'error',
            message: data.error,
          },
        ]);
        setIsOpen(true);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [flowId]);

  const clearMessages = () => {
    setMessages([]);
  };

  const formatMessage = (msg) => {
    if (typeof msg === 'object') {
      return JSON.stringify(msg, null, 2);
    }
    return String(msg);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 p-3 rounded-full shadow-lg transition-colors ${
          messages.length > 0 && !isOpen
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
        }`}
        title="Toggle Debug Panel"
      >
        <Terminal className="w-5 h-5" />
        {messages.length > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {messages.length > 99 ? '99+' : messages.length}
          </span>
        )}
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 left-0 h-64 bg-gray-900 border-t border-gray-700 shadow-2xl flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-gray-200">Debug Output</h3>
              <span className="text-xs text-gray-500">
                {messages.length} message{messages.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearMessages}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-700 rounded text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
            {messages.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                No debug messages yet. Trigger an inject node to see output.
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2 rounded ${
                    msg.type === 'error'
                      ? 'bg-red-900/20 border-l-2 border-red-500'
                      : 'bg-gray-800/50 border-l-2 border-blue-500'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 shrink-0">
                      {formatTime(msg.timestamp)}
                    </span>
                    <span className="text-blue-400 shrink-0">
                      [{msg.nodeName || msg.nodeId}]
                    </span>
                    <pre className="text-gray-300 whitespace-pre-wrap break-all flex-1">
                      {formatMessage(msg.message)}
                    </pre>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
