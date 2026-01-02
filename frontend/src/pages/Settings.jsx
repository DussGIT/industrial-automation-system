import React, { useState, useEffect } from 'react'
import { Save, AlertTriangle, RefreshCw } from 'lucide-react'

const Settings = () => {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [changedKeys, setChangedKeys] = useState([])

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      const data = await response.json()
      setSettings(data.settings)
    } catch (error) {
      console.error('Error fetching settings:', error)
      setMessage({ type: 'error', text: 'Failed to load settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (key, value) => {
    const [category] = key.split('.')
    setSettings(prev => ({
      ...prev,
      [category]: prev[category].map(setting => 
        setting.key === key ? { ...setting, value } : setting
      )
    }))
    
    if (!changedKeys.includes(key)) {
      setChangedKeys(prev => [...prev, key])
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    
    try {
      // Update all changed settings
      for (const key of changedKeys) {
        const category = key.split('.')[0]
        const setting = settings[category].find(s => s.key === key)
        
        await fetch(`/api/settings/${key}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: setting.value })
        })
      }
      
      // Check if restart is required
      const restartResponse = await fetch('/api/settings/restart-required', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: changedKeys })
      })
      const { restartRequired } = await restartResponse.json()
      
      setMessage({ 
        type: 'success', 
        text: restartRequired 
          ? 'Settings saved! Please restart the backend for changes to take effect.' 
          : 'Settings saved successfully!'
      })
      setChangedKeys([])
    } catch (error) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400 mb-8">System configuration and preferences</p>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-gray-400">System configuration and preferences</p>
        </div>
        
        {changedKeys.length > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          message.type === 'error' 
            ? 'bg-red-500/10 border-red-500/50 text-red-400' 
            : message.text.includes('restart')
            ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400'
            : 'bg-green-500/10 border-green-500/50 text-green-400'
        }`}>
          <div className="flex items-start gap-2">
            {message.text.includes('restart') && <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />}
            <p>{message.text}</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(settings).map(([category, categorySettings]) => (
          <div key={category} className="bg-dark-surface rounded-lg border border-dark-border">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-semibold capitalize">{category}</h2>
            </div>
            
            <div className="p-6 space-y-6">
              {categorySettings.map(setting => (
                <div key={setting.key} className="grid grid-cols-3 gap-4 items-start">
                  <div>
                    <label className="text-sm font-medium block mb-1">
                      {setting.label}
                    </label>
                    {setting.description && (
                      <p className="text-xs text-gray-400">{setting.description}</p>
                    )}
                  </div>
                  
                  <div className="col-span-2">
                    {setting.type === 'number' ? (
                      <input
                        type="number"
                        value={setting.value}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 focus:outline-none focus:border-primary"
                      />
                    ) : (
                      <input
                        type="text"
                        value={setting.value}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 focus:outline-none focus:border-primary"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Settings
