import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import api from '../../services/api'

const NodeConfigPanel = ({ node, onClose, onSave, isRunning = false }) => {
  const [config, setConfig] = useState(() => {
    const initialConfig = node?.data?.config || {}
    // For radio-gpio-broadcast nodes, ensure audioSource has a default value
    if (node?.data?.type === 'radio-gpio-broadcast' && !initialConfig.audioSource) {
      initialConfig.audioSource = 'file'
    }
    return initialConfig
  })
  const [audioFiles, setAudioFiles] = useState([])
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [devices, setDevices] = useState([])
  const [loadingDevices, setLoadingDevices] = useState(false)

  // Load audio files if this is an audio-player node or radio-broadcast node
  useEffect(() => {
    if (node?.data?.type === 'audio-player' || node?.data?.type === 'radio-broadcast' || node?.data?.type === 'radio-gpio-broadcast') {
      loadAudioFiles()
    }
  }, [node?.data?.type])

  // Load devices if this is a device node
  useEffect(() => {
    if (node?.data?.type?.includes('xbee') || node?.data?.type?.includes('bluetooth')) {
      loadDevices()
    }
  }, [node?.data?.type])

  const loadAudioFiles = async () => {
    setLoadingAudio(true)
    try {
      const files = await api.get('/audio')
      setAudioFiles(files || [])
    } catch (error) {
      console.error('Failed to load audio files:', error)
      setAudioFiles([])
    } finally {
      setLoadingAudio(false)
    }
  }

  const loadDevices = async () => {
    setLoadingDevices(true)
    try {
      const response = await api.get('/devices')
      setDevices(response.devices || [])
    } catch (error) {
      console.error('Failed to load devices:', error)
      setDevices([])
    } finally {
      setLoadingDevices(false)
    }
  }

  const handleSave = () => {
    console.log('[NodeConfigPanel] Saving config:', config)
    console.log('[NodeConfigPanel] audioSource value:', config.audioSource)
    onSave(node.id, config)
    onClose()
  }

  if (!node) return null

  const renderConfigFields = () => {
    switch (node.data.type) {
      case 'inject':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Repeat</label>
              <select
                value={config.repeat || 'none'}
                onChange={(e) => setConfig({ ...config, repeat: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="interval">Interval</option>
                <option value="cron">Cron</option>
              </select>
            </div>
            {config.repeat === 'interval' && (
              <div>
                <label className="block text-sm font-medium mb-2">Interval (seconds)</label>
                <input
                  type="number"
                  value={config.interval || 60}
                  onChange={(e) => setConfig({ ...config, interval: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="1"
                />
              </div>
            )}
            {config.repeat === 'cron' && (
              <div>
                <label className="block text-sm font-medium mb-2">Cron Expression</label>
                <input
                  type="text"
                  value={config.cron || ''}
                  onChange={(e) => setConfig({ ...config, cron: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0 * * * *"
                />
              </div>
            )}
          </>
        )

      case 'gpio-out':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">GPIO Pin</label>
              <select
                value={config.pinName || config.pin || ''}
                onChange={(e) => {
                  const value = e.target.value
                  if (value.match(/^\d+$/)) {
                    setConfig({ ...config, pin: parseInt(value), pinName: null })
                  } else {
                    setConfig({ ...config, pinName: value, pin: null })
                  }
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Pin...</option>
                <optgroup label="Named Pins (Radio)">
                  <option value="PTT">PTT (Pin 13 - BCM GPIO27)</option>
                  <option value="CS0">CS0 (Pin 22 - BCM GPIO25)</option>
                  <option value="CS1">CS1 (Pin 18 - BCM GPIO24)</option>
                  <option value="CS2">CS2 (Pin 16 - BCM GPIO23)</option>
                  <option value="CS3">CS3 (Pin 15 - BCM GPIO22)</option>
                  <option value="CLEAR_CHANNEL">Clear Channel (Pin 32 - BCM GPIO12)</option>
                </optgroup>
                <optgroup label="Generic GPIO">
                  <option value="GPIO1">GPIO1 (Pin 12 - BCM GPIO18)</option>
                  <option value="GPIO7">GPIO7 (Pin 19 - BCM GPIO10)</option>
                  <option value="GPIO8">GPIO8 (Pin 21 - BCM GPIO9)</option>
                  <option value="GPIO13">GPIO13 (Pin 33 - BCM GPIO13)</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Value</label>
              <select
                value={config.value !== undefined ? config.value : 'auto'}
                onChange={(e) => {
                  const val = e.target.value
                  setConfig({ 
                    ...config, 
                    value: val === 'auto' ? null : val === 'true' 
                  })
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="auto">From msg.payload</option>
                <option value="true">HIGH (1)</option>
                <option value="false">LOW (0)</option>
              </select>
            </div>
          </>
        )

      case 'gpio-in':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">GPIO Pin</label>
              <select
                value={config.pinName || config.pin || ''}
                onChange={(e) => {
                  const value = e.target.value
                  if (value.match(/^\d+$/)) {
                    setConfig({ ...config, pin: parseInt(value), pinName: null })
                  } else {
                    setConfig({ ...config, pinName: value, pin: null })
                  }
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Pin...</option>
                <optgroup label="Named Pins (Radio)">
                  <option value="PTT">PTT (Pin 13 - BCM GPIO27)</option>
                  <option value="CS0">CS0 (Pin 22 - BCM GPIO25)</option>
                  <option value="CS1">CS1 (Pin 18 - BCM GPIO24)</option>
                  <option value="CS2">CS2 (Pin 16 - BCM GPIO23)</option>
                  <option value="CS3">CS3 (Pin 15 - BCM GPIO22)</option>
                  <option value="CLEAR_CHANNEL">Clear Channel (Pin 32 - BCM GPIO12)</option>
                </optgroup>
                <optgroup label="Generic GPIO">
                  <option value="GPIO1">GPIO1 (Pin 12 - BCM GPIO18)</option>
                  <option value="GPIO7">GPIO7 (Pin 19 - BCM GPIO10)</option>
                  <option value="GPIO8">GPIO8 (Pin 21 - BCM GPIO9)</option>
                  <option value="GPIO13">GPIO13 (Pin 33 - BCM GPIO13)</option>
                </optgroup>
              </select>
            </div>
          </>
        )

      case 'radio-ptt':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Radio</label>
              <select
                value={config.radioId || 'default'}
                onChange={(e) => setConfig({ ...config, radioId: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="default">ERM100 Primary</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Select which radio to control
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Action</label>
              <select
                value={config.action || 'pulse'}
                onChange={(e) => setConfig({ ...config, action: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="pulse">Pulse (timed)</option>
                <option value="on">Turn ON</option>
                <option value="off">Turn OFF</option>
              </select>
            </div>
            {config.action === 'pulse' && (
              <div>
                <label className="block text-sm font-medium mb-2">Duration (ms)</label>
                <input
                  type="number"
                  value={config.duration || 2000}
                  onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="100"
                  max="10000"
                  step="100"
                />
                <p className="text-xs text-gray-400 mt-1">How long to hold PTT button (100-10000ms)</p>
              </div>
            )}
          </>
        )

      case 'awr-erm100-transmit':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Channel (0-15)</label>
              <input
                type="number"
                value={config.channel !== undefined ? config.channel : 0}
                onChange={(e) => setConfig({ ...config, channel: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                max="15"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Mode</label>
              <select
                value={config.mode || 'manual'}
                onChange={(e) => setConfig({ ...config, mode: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="manual">Manual (Timed PTT)</option>
                <option value="audio">Play Audio File</option>
                <option value="tts">Text-to-Speech</option>
              </select>
            </div>

            {config.mode === 'manual' && (
              <div>
                <label className="block text-sm font-medium mb-2">Duration (ms)</label>
                <input
                  type="number"
                  value={config.duration || 2000}
                  onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) || 2000 })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="100"
                  max="30000"
                />
              </div>
            )}

            {config.mode === 'audio' && (
              <div>
                <label className="block text-sm font-medium mb-2">Audio File *</label>
                {loadingAudio ? (
                  <div className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400">
                    Loading audio files...
                  </div>
                ) : audioFiles.length === 0 ? (
                  <div className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400">
                    No audio files available. Upload files in the Audio Library.
                  </div>
                ) : (
                  <select
                    value={config.audioFileId || ''}
                    onChange={(e) => setConfig({ ...config, audioFileId: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select an audio file...</option>
                    {audioFiles.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.name} ({file.format.toUpperCase()}, {(file.size / 1024).toFixed(0)}KB, {file.duration}s)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {config.mode === 'tts' && (
              <div>
                <label className="block text-sm font-medium mb-2">Text to Speak *</label>
                <textarea
                  value={config.ttsText || ''}
                  onChange={(e) => setConfig({ ...config, ttsText: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="4"
                  placeholder="Enter text to be spoken on the radio..."
                />
                <p className="text-sm text-gray-400 mt-1">
                  Text will be converted to speech using Piper TTS
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Pre-Key Delay (ms)</label>
              <input
                type="number"
                value={config.preKeyDelay !== undefined ? config.preKeyDelay : 100}
                onChange={(e) => setConfig({ ...config, preKeyDelay: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                max="5000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Post-Key Delay (ms)</label>
              <input
                type="number"
                value={config.postKeyDelay !== undefined ? config.postKeyDelay : 100}
                onChange={(e) => setConfig({ ...config, postKeyDelay: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                max="5000"
              />
            </div>
          </>
        )

      case 'awr-erm100-channel':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Channel (0-15)</label>
              <input
                type="number"
                value={config.channel !== undefined ? config.channel : 0}
                onChange={(e) => setConfig({ ...config, channel: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                max="15"
              />
              <p className="text-xs text-gray-400 mt-1">
                Set AWR ERM100 radio channel (0-15)
              </p>
            </div>
          </>
        )

      case 'awr-erm100-broadcast':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Channels (comma-separated)</label>
              <input
                type="text"
                value={config.channels ? config.channels.join(',') : '0,1,2,3'}
                onChange={(e) => {
                  const channels = e.target.value.split(',').map(ch => parseInt(ch.trim())).filter(ch => !isNaN(ch) && ch >= 0 && ch <= 15)
                  setConfig({ ...config, channels })
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0,1,2,3"
              />
              <p className="text-xs text-gray-400 mt-1">
                Example: 0,1,2,3 or 5,7,9
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Audio File (optional)</label>
              <select
                value={config.audioFileId || ''}
                onChange={(e) => setConfig({ ...config, audioFileId: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Manual mode (timed PTT)</option>
                {audioFiles.map(file => (
                  <option key={file.id} value={file.id}>
                    {file.name} ({file.format}, {(file.size / 1024).toFixed(1)}KB, {file.duration}s)
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Leave empty for manual timed PTT, or select audio file to play
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Duration per Channel (ms)</label>
              <input
                type="number"
                value={config.duration || 2000}
                onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) || 2000 })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="100"
                max="30000"
              />
              <p className="text-xs text-gray-400 mt-1">
                Only used if no audio file selected
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Delay Between Channels (ms)</label>
              <input
                type="number"
                value={config.delayBetween !== undefined ? config.delayBetween : 500}
                onChange={(e) => setConfig({ ...config, delayBetween: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                max="5000"
              />
            </div>
          </>
        )

      case 'radio-channel':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Radio</label>
              <select
                value={config.radioId || 'default'}
                onChange={(e) => setConfig({ ...config, radioId: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="default">ERM100 Primary</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Select which radio to control
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Channel (0-15)</label>
              <input
                type="number"
                value={config.channel !== undefined ? config.channel : ''}
                onChange={(e) => setConfig({ ...config, channel: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                max="15"
                placeholder="0-15"
              />
              <p className="text-xs text-gray-400 mt-1">
                Channel 0-15 (uses CS0-CS3 pins for binary selection)
              </p>
            </div>
          </>
        )

      case 'debug':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Output</label>
              <select
                value={config.output || 'msg'}
                onChange={(e) => setConfig({ ...config, output: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="msg">Complete message</option>
                <option value="payload">msg.payload only</option>
              </select>
            </div>
          </>
        )

      case 'delay':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Delay Amount</label>
              <input
                type="number"
                value={config.delayMs || 1000}
                onChange={(e) => setConfig({ ...config, delayMs: parseInt(e.target.value) || 1000 })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Unit</label>
              <select
                value={config.delayUnit || 'milliseconds'}
                onChange={(e) => setConfig({ ...config, delayUnit: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="milliseconds">Milliseconds</option>
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.rateLimited || false}
                  onChange={(e) => setConfig({ ...config, rateLimited: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Rate Limited (drop if busy)</span>
              </label>
              <p className="text-xs text-gray-400 mt-1">
                If enabled, drops new messages while a delay is in progress
              </p>
            </div>
          </>
        )

      case 'function':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Function Code</label>
              <textarea
                value={config.func || '// Write your code here\nreturn msg;'}
                onChange={(e) => setConfig({ ...config, func: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows="10"
                placeholder="return msg;"
              />
              <p className="text-xs text-gray-400 mt-1">
                Use 'msg' to access the message. Return msg or null.
              </p>
            </div>
          </>
        )

      case 'mqtt-in':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Topic</label>
              <input
                type="text"
                value={config.topic || ''}
                onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="sensor/temperature"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">QoS</label>
              <select
                value={config.qos || 0}
                onChange={(e) => setConfig({ ...config, qos: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>0 - At most once</option>
                <option value={1}>1 - At least once</option>
                <option value={2}>2 - Exactly once</option>
              </select>
            </div>
          </>
        )

      case 'mqtt-out':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Topic</label>
              <input
                type="text"
                value={config.topic || ''}
                onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="actuator/command"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">QoS</label>
              <select
                value={config.qos || 0}
                onChange={(e) => setConfig({ ...config, qos: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>0 - At most once</option>
                <option value={1}>1 - At least once</option>
                <option value={2}>2 - Exactly once</option>
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.retain || false}
                  onChange={(e) => setConfig({ ...config, retain: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Retain message</span>
              </label>
            </div>
          </>
        )

      case 'zigbee-button':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Device Address</label>
              <input
                type="text"
                value={config.deviceAddress || ''}
                onChange={(e) => setConfig({ ...config, deviceAddress: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0x00158d0001234567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Action Filter</label>
              <select
                value={config.action || 'all'}
                onChange={(e) => setConfig({ ...config, action: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All actions</option>
                <option value="single">Single click</option>
                <option value="double">Double click</option>
                <option value="triple">Triple click</option>
                <option value="long">Long press</option>
                <option value="release">Release</option>
              </select>
            </div>
          </>
        )

      case 'camera-event':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Camera ID</label>
              <input
                type="text"
                value={config.cameraId || ''}
                onChange={(e) => setConfig({ ...config, cameraId: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="camera-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Event Type</label>
              <select
                value={config.eventType || 'all'}
                onChange={(e) => setConfig({ ...config, eventType: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All events</option>
                <option value="motion">Motion detection</option>
                <option value="dwelling">Dwelling detection</option>
                <option value="lineCrossing">Line crossing</option>
                <option value="intrusion">Intrusion detection</option>
                <option value="faceDetection">Face detection</option>
                <option value="tamper">Tamper detection</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Min Confidence (%)</label>
              <input
                type="number"
                value={config.minConfidence || 0}
                onChange={(e) => setConfig({ ...config, minConfidence: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                max="100"
              />
            </div>
          </>
        )

      case 'audio-player':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Audio File *</label>
              {loadingAudio ? (
                <div className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400">
                  Loading audio files...
                </div>
              ) : audioFiles.length === 0 ? (
                <div className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400">
                  No audio files available. Upload files in the Audio Library.
                </div>
              ) : (
                <select
                  value={config.audioFileId || ''}
                  onChange={(e) => setConfig({ ...config, audioFileId: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select an audio file...</option>
                  {audioFiles.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.name} ({file.format.toUpperCase()}, {(file.size / 1024).toFixed(0)}KB, {file.duration}s)
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Volume (%)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  value={config.volume || 100}
                  onChange={(e) => setConfig({ ...config, volume: parseInt(e.target.value) })}
                  className="flex-1"
                  min="0"
                  max="100"
                />
                <span className="text-sm w-12 text-right">{config.volume || 100}%</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Repeat</label>
              <input
                type="number"
                value={config.repeat || 1}
                onChange={(e) => setConfig({ ...config, repeat: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="1"
                max="10"
              />
              <p className="text-xs text-gray-400 mt-1">
                Number of times to play the audio (1-10)
              </p>
            </div>
          </>
        )

      case 'radio-broadcast':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Audio File *</label>
              {loadingAudio ? (
                <div className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400">
                  Loading audio files...
                </div>
              ) : audioFiles.length === 0 ? (
                <div className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400">
                  No audio files available. Upload files in the Audio Library.
                </div>
              ) : (
                <select
                  value={config.audioFileId || ''}
                  onChange={(e) => setConfig({ ...config, audioFileId: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select an audio file...</option>
                  {audioFiles.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.name} ({file.format.toUpperCase()}, {(file.size / 1024).toFixed(0)}KB, {file.duration}s)
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Channel (0-15) *</label>
              <input
                type="number"
                value={config.channel !== undefined ? config.channel : ''}
                onChange={(e) => setConfig({ ...config, channel: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                max="15"
                placeholder="0-15"
              />
              <p className="text-xs text-gray-400 mt-1">
                Radio channel 0-15 (uses CS0-CS3 GPIO pins)
              </p>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.waitForClear !== false}
                  onChange={(e) => setConfig({ ...config, waitForClear: e.target.checked })}
                  className="w-4 h-4 bg-gray-700 border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">Wait for Clear Channel</span>
              </label>
              <p className="text-xs text-gray-400 mt-1">
                Wait for channel to be clear before transmitting
              </p>
            </div>
            {config.waitForClear !== false && (
              <div>
                <label className="block text-sm font-medium mb-2">Clear Channel Timeout (ms)</label>
                <input
                  type="number"
                  value={config.clearChannelTimeout || 5000}
                  onChange={(e) => setConfig({ ...config, clearChannelTimeout: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="1000"
                  max="30000"
                  step="1000"
                />
                <p className="text-xs text-gray-400 mt-1">
                  How long to wait for clear channel (1000-30000ms)
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">Repeat</label>
              <input
                type="number"
                value={config.repeat || 1}
                onChange={(e) => setConfig({ ...config, repeat: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="1"
                max="10"
              />
              <p className="text-xs text-gray-400 mt-1">
                Number of times to play the audio (1-10)
              </p>
            </div>
          </>
        )

      case 'radio-gpio-broadcast':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Optional name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Radio</label>
              <select
                value={config.radioId || 'default'}
                onChange={(e) => setConfig({ ...config, radioId: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="default">ERM100 Primary</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Select which radio to broadcast on
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Audio Source *</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="audioSource"
                    value="file"
                    checked={config.audioSource === 'file' || !config.audioSource}
                    onChange={(e) => setConfig({ ...config, audioSource: e.target.value })}
                    className="w-4 h-4 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm">Pre-recorded File</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="audioSource"
                    value="tts"
                    checked={config.audioSource === 'tts'}
                    onChange={(e) => setConfig({ ...config, audioSource: e.target.value })}
                    className="w-4 h-4 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm">Text-to-Speech (TTS)</span>
                </label>
              </div>
            </div>

            {(config.audioSource === 'file' || !config.audioSource) && (
              <div>
                <label className="block text-sm font-medium mb-2">Audio File *</label>
                {loadingAudio ? (
                  <div className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400">
                    Loading audio files...
                  </div>
                ) : audioFiles.length === 0 ? (
                  <div className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400">
                    No audio files available. Upload files in the Audio Library.
                  </div>
                ) : (
                  <select
                    value={config.audioFileId || ''}
                    onChange={(e) => setConfig({ ...config, audioFileId: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select an audio file...</option>
                    {audioFiles.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.name} ({file.format.toUpperCase()}, {(file.size / 1024).toFixed(0)}KB, {file.duration}s)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {config.audioSource === 'tts' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">TTS Text *</label>
                  <textarea
                    value={config.ttsText || ''}
                    onChange={(e) => setConfig({ ...config, ttsText: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows="3"
                    placeholder="Emergency alert from button {{buttonNumber}}"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Use template variables: <code className="bg-gray-700 px-1 rounded">{'{{buttonNumber}}'}</code>, <code className="bg-gray-700 px-1 rounded">{'{{msg.payload.temperature}}'}</code>, etc.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Voice</label>
                  <select
                    value={config.ttsVoice || 'en_US-lessac-medium'}
                    onChange={(e) => setConfig({ ...config, ttsVoice: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="en_US-lessac-medium">en_US-lessac-medium (Default)</option>
                    <option value="en_US-lessac-low">en_US-lessac-low</option>
                    <option value="en_US-libritts-high">en_US-libritts-high</option>
                    <option value="en_GB-alan-medium">en_GB-alan-medium</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Speed</label>
                  <select
                    value={config.ttsSpeed || '1.0'}
                    onChange={(e) => setConfig({ ...config, ttsSpeed: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="0.75">0.75x (Slow)</option>
                    <option value="1.0">1.0x (Normal)</option>
                    <option value="1.25">1.25x (Fast)</option>
                    <option value="1.5">1.5x (Very Fast)</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Channel (0-15) *</label>
              <input
                type="number"
                value={config.channel !== undefined ? config.channel : ''}
                onChange={(e) => setConfig({ ...config, channel: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                max="15"
                placeholder="0-15"
              />
              <p className="text-xs text-gray-400 mt-1">
                Radio channel 0-15 (uses CS0-CS3 GPIO pins)
              </p>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.waitForClear !== false}
                  onChange={(e) => setConfig({ ...config, waitForClear: e.target.checked })}
                  className="w-4 h-4 bg-gray-700 border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">Wait for Clear Channel</span>
              </label>
              <p className="text-xs text-gray-400 mt-1">
                Wait for channel to be clear before transmitting
              </p>
            </div>
            {config.waitForClear !== false && (
              <div>
                <label className="block text-sm font-medium mb-2">Clear Channel Timeout (ms)</label>
                <input
                  type="number"
                  value={config.clearChannelTimeout || 5000}
                  onChange={(e) => setConfig({ ...config, clearChannelTimeout: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="1000"
                  max="30000"
                  step="1000"
                />
                <p className="text-xs text-gray-400 mt-1">
                  How long to wait for clear channel (1000-30000ms)
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">Repeat</label>
              <input
                type="number"
                value={config.repeat || 1}
                onChange={(e) => setConfig({ ...config, repeat: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="1"
                max="10"
              />
              <p className="text-xs text-gray-400 mt-1">
                Number of times to play the audio (1-10)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Repeat Delay (ms)</label>
              <input
                type="number"
                value={config.repeatDelay !== undefined ? config.repeatDelay : 0}
                onChange={(e) => setConfig({ ...config, repeatDelay: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                max="60000"
                step="1000"
              />
              <p className="text-xs text-gray-400 mt-1">
                Delay between repeats in milliseconds (0-60000ms)
              </p>
            </div>
          </>
        )

      case 'cancel-broadcast':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Cancel Source</label>
              <input
                type="text"
                value={config.cancelSource !== undefined ? config.cancelSource : ''}
                onChange={(e) => setConfig({ ...config, cancelSource: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., button1 or {{buttonName}}"
              />
              <p className="text-xs text-gray-400 mt-1">
                Source identifier to cancel. Leave empty to use message payload (source, buttonName, deviceName).
                Use template variables: <code className="bg-gray-700 px-1 rounded">{'{{buttonName}}'}</code>, <code className="bg-gray-700 px-1 rounded">{'{{payload.source}}'}</code>
              </p>
            </div>
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-400 mb-2">How it Works</h4>
              <p className="text-xs text-gray-300">
                This node cancels all pending broadcasts from the specified source. 
                Each broadcast node uses a source identifier (usually the button name or device name).
                When cancelled, any queued repeats from that source will be skipped.
              </p>
            </div>
          </>
        )

      case 'xbee-in':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Device</label>
              {loadingDevices ? (
                <div className="text-sm text-gray-400">Loading devices...</div>
              ) : (
                <select
                  value={config.deviceAddress || ''}
                  onChange={(e) => setConfig({ ...config, deviceAddress: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Devices</option>
                  {devices.filter(d => d.type === 'xbee').map(device => (
                    <option key={device.address} value={device.address}>
                      {device.name || device.address}
                    </option>
                  ))}
                </select>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Button Number</label>
              <select
                value={config.buttonNumber || ''}
                onChange={(e) => {
                  const buttonNum = e.target.value;
                  const newConfig = { ...config, buttonNumber: buttonNum };
                  // Auto-set filter based on selections
                  if (buttonNum === '') {
                    newConfig.filterType = 'contains';
                    newConfig.payloadFilter = '';
                  } else {
                    newConfig.filterType = 'button';
                    newConfig.payloadFilter = config.buttonAction === 'cancel' ? 'cancel' : buttonNum;
                  }
                  setConfig(newConfig);
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any Button</option>
                <option value="0">Button 0</option>
                <option value="1">Button 1</option>
                <option value="2">Button 2</option>
                <option value="3">Button 3</option>
                <option value="4">Button 4</option>
                <option value="5">Button 5</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Action</label>
              <select
                value={config.buttonAction || 'trigger'}
                onChange={(e) => {
                  const action = e.target.value;
                  const newConfig = { ...config, buttonAction: action };
                  // Auto-set filter based on selections
                  if (config.buttonNumber) {
                    newConfig.filterType = 'button';
                    newConfig.payloadFilter = action === 'cancel' ? 'cancel' : config.buttonNumber;
                  }
                  setConfig(newConfig);
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="trigger">Button Press/Trigger</option>
                <option value="cancel">Cancel Event</option>
                <option value="">Any Action</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {config.buttonAction === 'cancel' 
                  ? 'Cancel event occurs when hand is held over button after triggering' 
                  : 'Trigger when button detects proximity'}
              </p>
            </div>
          </>
        )

      case 'zigbee-in':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Device Name</label>
              <input
                type="text"
                value={config.deviceName || ''}
                onChange={(e) => setConfig({ ...config, deviceName: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Leave empty for all devices"
              />
              <p className="text-xs text-gray-400 mt-1">
                Zigbee device friendly name (optional - leave empty to receive from all devices)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Event Type</label>
              <select
                value={config.eventType || 'all'}
                onChange={(e) => setConfig({ ...config, eventType: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Events</option>
                <option value="state">State Changes Only</option>
                <option value="action">Actions Only</option>
                <option value="brightness">Brightness Changes</option>
                <option value="temperature">Temperature Updates</option>
                <option value="occupancy">Occupancy Detection</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Filter events by type
              </p>
            </div>
          </>
        )

      case 'xbee-out':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Target Device</label>
              {loadingDevices ? (
                <div className="text-sm text-gray-400">Loading devices...</div>
              ) : (
                <select
                  value={config.deviceAddress || ''}
                  onChange={(e) => setConfig({ ...config, deviceAddress: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Device...</option>
                  {devices.filter(d => d.type === 'xbee').map(device => (
                    <option key={device.address64} value={device.address64}>
                      {device.name || device.address64} ({device.address64})
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-gray-400 mt-1">
                XBee device to send data to (can be overridden by msg.address)
              </p>
            </div>
          </>
        )

      case 'bluetooth-in':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Device Address</label>
              <select
                value={config.deviceAddress || ''}
                onChange={(e) => setConfig({ ...config, deviceAddress: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Devices</option>
                {devices.filter(d => d.type === 'bluetooth').map(device => (
                  <option key={device.id} value={device.address}>
                    {device.name} ({device.address})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Leave empty to receive from all Bluetooth devices
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Service UUID (Optional)</label>
              <input
                type="text"
                value={config.serviceUuid || ''}
                onChange={(e) => setConfig({ ...config, serviceUuid: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Leave empty for all services"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Characteristic UUID (Optional)</label>
              <input
                type="text"
                value={config.characteristicUuid || ''}
                onChange={(e) => setConfig({ ...config, characteristicUuid: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Leave empty for all characteristics"
              />
            </div>
          </>
        )

      case 'bluetooth-out':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Device Address</label>
              <select
                value={config.deviceAddress || ''}
                onChange={(e) => setConfig({ ...config, deviceAddress: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Device...</option>
                {devices.filter(d => d.type === 'bluetooth').map(device => (
                  <option key={device.id} value={device.address}>
                    {device.name} ({device.address})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Bluetooth device to send data to
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Service UUID</label>
              <input
                type="text"
                value={config.serviceUuid || ''}
                onChange={(e) => setConfig({ ...config, serviceUuid: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="GATT Service UUID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Characteristic UUID</label>
              <input
                type="text"
                value={config.characteristicUuid || ''}
                onChange={(e) => setConfig({ ...config, characteristicUuid: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="GATT Characteristic UUID"
              />
            </div>
          </>
        )

      case 'zigbee-out':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Device Name</label>
              <input
                type="text"
                value={config.deviceName || ''}
                onChange={(e) => setConfig({ ...config, deviceName: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Living Room Light"
              />
              <p className="text-xs text-gray-400 mt-1">
                Zigbee device friendly name (can be overridden by message)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Command</label>
              <select
                value={config.command || 'state'}
                onChange={(e) => setConfig({ ...config, command: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="state">On/Off</option>
                <option value="brightness">Brightness</option>
                <option value="color_temp">Color Temperature</option>
                <option value="color">Color (RGB/HSV)</option>
                <option value="position">Position (Blinds)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Command to send to device
              </p>
            </div>
            {config.command === 'state' && (
              <div>
                <label className="block text-sm font-medium mb-2">State</label>
                <select
                  value={config.value || 'ON'}
                  onChange={(e) => setConfig({ ...config, value: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ON">On</option>
                  <option value="OFF">Off</option>
                  <option value="TOGGLE">Toggle</option>
                </select>
              </div>
            )}
            {config.command === 'brightness' && (
              <div>
                <label className="block text-sm font-medium mb-2">Brightness (0-255)</label>
                <input
                  type="number"
                  value={config.value || 255}
                  onChange={(e) => setConfig({ ...config, value: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="255"
                />
              </div>
            )}
            {config.command === 'color_temp' && (
              <div>
                <label className="block text-sm font-medium mb-2">Color Temperature (150-500)</label>
                <input
                  type="number"
                  value={config.value || 300}
                  onChange={(e) => setConfig({ ...config, value: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="150"
                  max="500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Warm (500) to Cool (150)
                </p>
              </div>
            )}
            {config.command === 'position' && (
              <div>
                <label className="block text-sm font-medium mb-2">Position (0-100%)</label>
                <input
                  type="number"
                  value={config.value || 100}
                  onChange={(e) => setConfig({ ...config, value: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="100"
                />
                <p className="text-xs text-gray-400 mt-1">
                  0 = Closed, 100 = Open
                </p>
              </div>
            )}
          </>
        )

      default:
        return (
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={config.name || ''}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Optional name"
            />
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">
            Configure {node.data.label || node.data.type}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-white">
          {renderConfigFields()}
        </div>
        
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isRunning}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={isRunning ? 'Stop the flow before saving node configuration' : ''}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default NodeConfigPanel
