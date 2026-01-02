import React from 'react'
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
  Volume2,
  RadioTower,
  Lightbulb,
  Power,
  ChevronsRight,
  Hash,
  Mic
} from 'lucide-react'

const nodeCategories = [
  {
    name: 'Common',
    nodes: [
      { type: 'inject', label: 'Inject', icon: Clock, description: 'Trigger flows on schedule or manually' },
      { type: 'debug', label: 'Debug', icon: Bug, description: 'Output messages to debug panel' },
      { type: 'function', label: 'Function', icon: Code, description: 'Execute custom JavaScript' },
    ]
  },
  {
    name: 'Network',
    nodes: [
      { type: 'mqtt-in', label: 'MQTT In', icon: Wifi, description: 'Receive MQTT messages' },
      { type: 'mqtt-out', label: 'MQTT Out', icon: Wifi, description: 'Send MQTT messages' },
      { type: 'http', label: 'HTTP', icon: Network, description: 'Make HTTP requests' },
    ]
  },
  {
    name: 'Wireless',
    nodes: [
      { type: 'xbee-in', label: 'XBee In', icon: Radio, description: 'Receive XBee device data' },
      { type: 'xbee-out', label: 'XBee Out', icon: Lightbulb, description: 'Send data to XBee devices' },
      { type: 'bluetooth-in', label: 'Bluetooth In', icon: Wifi, description: 'Receive Bluetooth device data' },
      { type: 'bluetooth-out', label: 'Bluetooth Out', icon: Wifi, description: 'Send data to Bluetooth devices' },
    ]
  },
  {
    name: 'Camera',
    nodes: [
      { type: 'camera-event', label: 'Camera Event', icon: Camera, description: 'Receive IP camera events' },
    ]
  },
  {
    name: 'Output',
    nodes: [
      { type: 'audio-player', label: 'Audio Player', icon: Volume2, description: 'Play audio files on computer speakers' },
      { type: 'radio-broadcast', label: 'Radio Broadcast', icon: RadioTower, description: 'Broadcast audio over radio' },
      { type: 'gpio-out', label: 'GPIO Out', icon: Zap, description: 'Set GPIO pin high or low' },
      { type: 'radio-ptt', label: 'Radio PTT', icon: Mic, description: 'Control Push To Talk' },
      { type: 'radio-channel', label: 'Radio Channel', icon: Hash, description: 'Select radio channel (0-15)' },
    ]
  },
  {
    name: 'Input',
    nodes: [
      { type: 'gpio-in', label: 'GPIO In', icon: ChevronsRight, description: 'Read GPIO pin state' },
    ]
  },
]

const NodePalette = ({ onNodeDragStart }) => {
  const handleDragStart = (event, nodeType, label) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.setData('nodeLabel', label)
    event.dataTransfer.effectAllowed = 'move'
    if (onNodeDragStart) {
      onNodeDragStart(nodeType)
    }
  }

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col" style={{ height: '100vh' }}>
      <div className="p-4 flex-shrink-0">
        <h2 className="text-lg font-bold mb-4 text-white">Node Palette</h2>
      </div>
      <div className="flex-1 overflow-y-scroll px-4 pb-4" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        <div>
        
        {nodeCategories.map((category) => (
          <div key={category.name} className="mb-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              {category.name}
            </h3>
            <div className="space-y-2">
              {category.nodes.map((node) => {
                const Icon = node.icon
                return (
                  <div
                    key={node.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, node.type, node.label)}
                    className="flex items-start gap-3 p-3 bg-gray-700 rounded-lg cursor-move hover:bg-gray-600 transition-colors"
                  >
                    <Icon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm">
                        {node.label}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {node.description}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  )
}

export default NodePalette
