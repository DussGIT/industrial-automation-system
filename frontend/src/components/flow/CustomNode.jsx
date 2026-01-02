import React from 'react'
import { Handle, Position } from 'reactflow'
import { 
  Clock, 
  Bug, 
  Code, 
  Wifi, 
  Radio, 
  Camera, 
  Zap,
  Database,
  Network,
  Play,
  Volume2,
  RadioTower,
  Lightbulb
} from 'lucide-react'

const nodeIcons = {
  inject: Clock,
  debug: Bug,
  function: Code,
  mqtt: Wifi,
  'mqtt-in': Wifi,
  'mqtt-out': Wifi,
  'xbee-in': Radio,
  'xbee-out': Lightbulb,
  'camera-event': Camera,
  trigger: Zap,
  database: Database,
  http: Network,
  'audio-player': Volume2,
  'radio-broadcast': RadioTower,
}

const nodeColors = {
  // Common nodes
  inject: 'bg-blue-500',
  debug: 'bg-gray-500',
  function: 'bg-orange-500',
  
  // Network nodes
  mqtt: 'bg-purple-500',
  'mqtt-in': 'bg-purple-500',
  'mqtt-out': 'bg-purple-500',
  http: 'bg-green-500',
  
  // Wireless nodes
  'xbee-in': 'bg-yellow-500',
  'xbee-out': 'bg-amber-600',
  
  // Camera nodes
  'camera-event': 'bg-red-500',
  
  // Output nodes
  'audio-player': 'bg-purple-600',
  'radio-broadcast': 'bg-pink-600',
  
  // Other
  trigger: 'bg-indigo-500',
  database: 'bg-cyan-500',
}

const CustomNode = ({ data, selected, id }) => {
  const Icon = nodeIcons[data.type] || Code
  const colorClass = nodeColors[data.type] || 'bg-gray-500'
  
  const handleTrigger = (e) => {
    e.stopPropagation()
    if (data.onTrigger) {
      data.onTrigger(id)
    }
  }
  
  return (
    <div className={`custom-node ${selected ? 'selected' : ''}`}>
      {/* Input handle - only show if node can receive inputs */}
      {!['inject', 'mqtt-in', 'zigbee-button', 'camera-event'].includes(data.type) && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 !bg-gray-300 border-2 border-gray-600"
        />
      )}
      
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border-2 ${
        selected ? 'border-blue-400' : 'border-gray-700'
      } ${colorClass} text-white min-w-[150px] relative`}>
        <Icon className="w-4 h-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {data.label || data.type}
          </div>
          {data.config?.name && (
            <div className="text-xs opacity-75 truncate">
              {data.config.name}
            </div>
          )}
        </div>
        
        {/* Manual trigger button for inject nodes */}
        {data.type === 'inject' && (
          <button
            onClick={handleTrigger}
            className="w-6 h-6 rounded bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            title="Trigger manually"
          >
            <Play className="w-3 h-3" />
          </button>
        )}
      </div>
      
      {/* Output handle - only show if node can produce outputs */}
      {!['debug'].includes(data.type) && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 !bg-gray-300 border-2 border-gray-600"
        />
      )}
    </div>
  )
}

export default CustomNode
