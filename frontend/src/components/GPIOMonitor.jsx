import React, { useState, useEffect } from 'react'
import { X, Minimize2, Maximize2, Cpu, ArrowRight, ArrowLeft } from 'lucide-react'
import api from '../services/api'

const GPIOMonitor = ({ onClose }) => {
  const [isMinimized, setIsMinimized] = useState(false)
  const [gpioStatus, setGpioStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('40pin') // '40pin' or '16pin'
  const [selectedChannel, setSelectedChannel] = useState(0)
  const [channelMessage, setChannelMessage] = useState(null)

  // Pin mappings - Physical pin numbers with BCM GPIO numbers
  const pin40Mapping = [
    // Left column (odd pins)
    { physical: 1, name: '3.3V', type: 'power' },
    { physical: 3, name: 'I2C SDA', type: 'i2c' },
    { physical: 5, name: 'I2C SCL', type: 'i2c' },
    { physical: 7, name: 'GPIO4', type: 'gpio' },
    { physical: 9, name: 'GND', type: 'ground' },
    { physical: 11, name: 'GPIO17', type: 'gpio' },
    { physical: 13, name: 'PTT', type: 'gpio', label: 'PTT' },
    { physical: 15, name: 'CS3', type: 'gpio', label: 'CS3' },
    { physical: 17, name: '3.3V', type: 'power' },
    { physical: 19, name: 'GPIO10', type: 'gpio' },
    { physical: 21, name: 'GPIO9', type: 'gpio' },
    { physical: 23, name: 'GPIO11', type: 'spi' },
    { physical: 25, name: 'GND', type: 'ground' },
    { physical: 27, name: 'ID SD', type: 'reserved' },
    { physical: 29, name: 'GPIO5', type: 'gpio' },
    { physical: 31, name: 'GPIO6', type: 'gpio' },
    { physical: 33, name: 'GPIO13', type: 'gpio' },
    { physical: 35, name: 'GPIO19', type: 'gpio' },
    { physical: 37, name: 'GPIO26', type: 'gpio' },
    { physical: 39, name: 'GND', type: 'ground' },
    // Right column (even pins)
    { physical: 2, name: '5V', type: 'power' },
    { physical: 4, name: '5V', type: 'power' },
    { physical: 6, name: 'GND', type: 'ground' },
    { physical: 8, name: 'GPIO14', type: 'uart' },
    { physical: 10, name: 'GPIO15', type: 'uart' },
    { physical: 12, name: 'GPIO18', type: 'gpio' },
    { physical: 14, name: 'GND', type: 'ground' },
    { physical: 16, name: 'CS2', type: 'gpio', label: 'CS2' },
    { physical: 18, name: 'CS1', type: 'gpio', label: 'CS1' },
    { physical: 20, name: 'GND', type: 'ground' },
    { physical: 22, name: 'CS0', type: 'gpio', label: 'CS0' },
    { physical: 24, name: 'GPIO8', type: 'spi' },
    { physical: 26, name: 'GPIO7', type: 'spi' },
    { physical: 28, name: 'ID SC', type: 'reserved' },
    { physical: 30, name: 'GND', type: 'ground' },
    { physical: 32, name: 'Clear Ch', type: 'gpio', label: 'Clear Ch' },
    { physical: 34, name: 'GND', type: 'ground' },
    { physical: 36, name: 'GPIO16', type: 'gpio' },
    { physical: 38, name: 'GPIO20', type: 'gpio' },
    { physical: 40, name: 'GPIO21', type: 'gpio' },
  ]

  // External 16-pin GREEN connector mapping (from GPIO_CONFIGURATION.md)
  const pin16Mapping = [
    { physical: 1, name: 'PWR 5V', type: 'power', maps40: 2 },
    { physical: 2, name: 'PWR 5V', type: 'power', maps40: 4 },
    { physical: 3, name: 'Mike 5V', type: 'power', maps40: 4 },
    { physical: 4, name: 'GREEN', type: 'gpio', maps40: 5 },
    { physical: 5, name: 'PWR GND', type: 'ground', maps40: 6 },
    { physical: 6, name: 'MIKE GND', type: 'ground', maps40: 9 },
    { physical: 7, name: 'BLUE', type: 'gpio', maps40: 12 },
    { physical: 8, name: 'PTT', type: 'gpio', maps40: 13, label: 'PTT' },
    { physical: 9, name: 'CS3', type: 'gpio', maps40: 15, label: 'CS3' },
    { physical: 10, name: 'CS2', type: 'gpio', maps40: 16, label: 'CS2' },
    { physical: 11, name: 'CS1', type: 'gpio', maps40: 18, label: 'CS1' },
    { physical: 12, name: 'GREEN', type: 'gpio', maps40: 19 },
    { physical: 13, name: 'BLUE', type: 'gpio', maps40: 21 },
    { physical: 14, name: 'CS0', type: 'gpio', maps40: 22, label: 'CS0' },
    { physical: 15, name: 'Clear Ch', type: 'gpio', maps40: 32, label: 'Clear Ch' },
    { physical: 16, name: 'GREY', type: 'gpio', maps40: 33 },
  ]

  useEffect(() => {
    fetchGPIOStatus()
    const interval = setInterval(fetchGPIOStatus, 1000) // Update every second
    return () => clearInterval(interval)
  }, [])

  const fetchGPIOStatus = async () => {
    try {
      const response = await api.get('/gpio/status')
      setGpioStatus(response)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch GPIO status:', error)
      setLoading(false)
    }
  }

  const testChannel = async () => {
    setChannelMessage({ type: 'info', text: `Setting channel ${selectedChannel}...` })
    try {
      const response = await api.post('/gpio/channel', { channel: selectedChannel })
      if (response.success) {
        setChannelMessage({ 
          type: 'success', 
          text: `Channel ${selectedChannel} set! CS3=${response.csStates.cs3} CS2=${response.csStates.cs2} CS1=${response.csStates.cs1} CS0=${response.csStates.cs0}` 
        })
      } else {
        setChannelMessage({ type: 'error', text: `Failed to set channel ${selectedChannel}` })
      }
    } catch (error) {
      console.error('Failed to set channel:', error)
      setChannelMessage({ type: 'error', text: `Error: ${error.message}` })
    }
    setTimeout(() => setChannelMessage(null), 5000)
  }

  const getPinState = (physicalPin) => {
    if (!gpioStatus || !gpioStatus.states) return 'unknown'
    // Backend returns states indexed by physical pin number
    return gpioStatus.states[physicalPin] === 1 ? 'high' : 'low'
  }

  const getPinColor = (pin) => {
    if (pin.type === 'power') return 'bg-red-500'
    if (pin.type === 'ground') return 'bg-gray-700'
    if (pin.type === 'gpio') {
      // Look up state by physical pin number
      const state = getPinState(pin.maps40 || pin.physical)
      if (state === 'high') return 'bg-green-500'
      if (state === 'low') return 'bg-gray-600'
      return 'bg-gray-500'
    }
    return 'bg-blue-500'
  }

  const getPinDirection = (pin) => {
    if (pin.type !== 'gpio') return null
    // Check if pin is configured as input or output
    // Pins with these labels are typically outputs
    const outputPins = ['PTT', 'CS0', 'CS1', 'CS2', 'CS3', 'Clear Ch']
    return outputPins.includes(pin.label || pin.name) ? 'output' : 'input'
  }

  const Pin = ({ pin, isLeft }) => {
    const direction = getPinDirection(pin)
    
    return (
      <div className={`flex items-center gap-2 ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className="relative">
          <div
            className={`w-4 h-4 rounded-full ${getPinColor(pin)} border-2 border-gray-700 shadow-lg`}
            title={`Pin ${pin.physical}: ${pin.name}${pin.maps40 ? ` (40-pin: ${pin.maps40})` : ''}${pin.type === 'gpio' ? ` - ${getPinState(pin.maps40 || pin.physical)}` : ''}`}
          />
          {direction && (
            <div className="absolute -bottom-1 -right-1">
              {direction === 'output' ? (
                <ArrowRight className="w-3 h-3 text-orange-400 bg-gray-900 rounded-full p-0.5" title="Output" />
              ) : (
                <ArrowLeft className="w-3 h-3 text-blue-400 bg-gray-900 rounded-full p-0.5" title="Input" />
              )}
            </div>
          )}
        </div>
        <div className={`text-xs ${isLeft ? 'text-right' : 'text-left'} min-w-[80px]`}>
          <div className="font-semibold text-white">{pin.physical}</div>
          <div className="text-gray-400">{pin.label || pin.name}</div>
          {pin.gpio !== null && (
            <div className="text-gray-500 flex items-center gap-1 justify-${isLeft ? 'end' : 'start'}">
              <span>GPIO{pin.gpio}</span>
              {direction && (
                <span className={`text-[10px] ${direction === 'output' ? 'text-orange-400' : 'text-blue-400'}`}>
                  {direction === 'output' ? 'OUT' : 'IN'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-3 z-50">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-blue-400" />
          <span className="text-white font-medium">GPIO Monitor</span>
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Expand"
          >
            <Maximize2 className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed top-20 right-4 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 w-[500px] max-h-[80vh] overflow-hidden z-50">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-white">GPIO Pin Monitor</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`} />
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="px-4 py-2 bg-gray-850 flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setView('40pin')}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            view === '40pin'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          40-Pin Header
        </button>
        <button
          onClick={() => setView('16pin')}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            view === '16pin'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          16-Pin External
        </button>
      </div>

      {/* Channel Test Controls */}
      <div className="px-4 py-2 bg-gray-850 border-b border-gray-700">
        <div className="text-xs text-gray-400 mb-2">Channel Test</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="15"
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(parseInt(e.target.value))}
            className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
          />
          <button
            onClick={testChannel}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
          >
            Set Channel
          </button>
        </div>
        {channelMessage && (
          <div className={`mt-2 text-xs p-2 rounded ${
            channelMessage.type === 'success' ? 'bg-green-500/20 text-green-400' :
            channelMessage.type === 'error' ? 'bg-red-500/20 text-red-400' :
            'bg-blue-500/20 text-blue-400'
          }`}>
            {channelMessage.text}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 bg-gray-850 border-b border-gray-700">
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-300">High (3.3V)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gray-600" />
            <span className="text-gray-300">Low (0V)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-300">Power</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gray-700" />
            <span className="text-gray-300">Ground</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowRight className="w-3 h-3 text-orange-400" />
            <span className="text-gray-300">Output</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowLeft className="w-3 h-3 text-blue-400" />
            <span className="text-gray-300">Input</span>
          </div>
        </div>
      </div>

      {/* Pin Display */}
      <div className="p-4 overflow-y-auto max-h-[calc(80vh-200px)]">
        {view === '40pin' ? (
          <div>
            <div className="text-center text-xs text-gray-400 mb-4">UP Board 40-Pin GPIO Header</div>
            <div className="grid grid-cols-2 gap-y-3">
              {/* Left column */}
              <div className="space-y-3">
                {pin40Mapping
                  .filter(p => p.physical % 2 === 1)
                  .map(pin => (
                    <Pin key={pin.physical} pin={pin} isLeft={true} />
                  ))}
              </div>
              {/* Right column */}
              <div className="space-y-3">
                {pin40Mapping
                  .filter(p => p.physical % 2 === 0)
                  .map(pin => (
                    <Pin key={pin.physical} pin={pin} isLeft={false} />
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-center text-xs text-gray-400 mb-4">External 16-Pin Connector</div>
            <div className="grid grid-cols-2 gap-y-3">
              {/* Left column */}
              <div className="space-y-3">
                {pin16Mapping
                  .filter((_, idx) => idx % 2 === 0)
                  .map(pin => (
                    <Pin key={pin.physical} pin={pin} isLeft={true} />
                  ))}
              </div>
              {/* Right column */}
              <div className="space-y-3">
                {pin16Mapping
                  .filter((_, idx) => idx % 2 === 1)
                  .map(pin => (
                    <Pin key={pin.physical} pin={pin} isLeft={false} />
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GPIOMonitor
