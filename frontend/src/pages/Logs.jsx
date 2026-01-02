import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter, RefreshCw, Download, Trash2, AlertCircle, Info, AlertTriangle, Bug } from 'lucide-react'
import api from '../services/api'

export default function Logs() {
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { data: logs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['logs', levelFilter, serviceFilter],
    queryFn: async () => {
      const params = {}
      if (levelFilter !== 'all') params.level = levelFilter
      if (serviceFilter !== 'all') params.service = serviceFilter
      return await api.getLogs(params)
    },
    refetchInterval: autoRefresh ? 3000 : false,
  })

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      log.message?.toLowerCase().includes(searchLower) ||
      log.service?.toLowerCase().includes(searchLower) ||
      log.level?.toLowerCase().includes(searchLower)
    )
  })

  const getLevelIcon = (level) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'debug':
        return <Bug className="w-4 h-4 text-blue-500" />
      default:
        return <Info className="w-4 h-4 text-gray-500" />
    }
  }

  const getLevelColor = (level) => {
    switch (level) {
      case 'error':
        return 'bg-red-900/20 border-red-500/50 text-red-300'
      case 'warn':
        return 'bg-yellow-900/20 border-yellow-500/50 text-yellow-300'
      case 'debug':
        return 'bg-blue-900/20 border-blue-500/50 text-blue-300'
      default:
        return 'bg-gray-900/20 border-gray-500/50 text-gray-300'
    }
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const exportLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${formatTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] [${log.service}] ${log.message}`
    ).join('\n')
    
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearLogs = async () => {
    if (confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
      try {
        await api.post('/analytics/logs/clear')
        refetch()
      } catch (error) {
        console.error('Failed to clear logs:', error)
        alert('Failed to clear logs')
      }
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">System Logs</h1>
          <p className="text-gray-400 mt-1">
            {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} 
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportLogs}
            disabled={filteredLogs.length === 0}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={clearLogs}
            disabled={logs.length === 0}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search logs..."
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Level Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Level
            </label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>

          {/* Service Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Service
            </label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Services</option>
              <option value="ia-backend">Backend</option>
              <option value="flow-engine">Flow Engine</option>
              <option value="mqtt">MQTT</option>
              <option value="database">Database</option>
            </select>
          </div>
        </div>

        {/* Auto Refresh Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
            />
            Auto-refresh every 3 seconds
          </label>
          <button
            onClick={() => refetch()}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh Now
          </button>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">
            Loading logs...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            Failed to load logs: {error.message}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Info className="w-8 h-8 mx-auto mb-2" />
            {searchTerm ? 'No logs match your search' : 'No logs available'}
          </div>
        ) : (
          <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
            {filteredLogs.map((log, index) => (
              <div
                key={log.id || index}
                className={`p-4 border-l-4 ${getLevelColor(log.level)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getLevelIcon(log.level)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-mono text-gray-500">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-gray-700 rounded">
                        {log.level.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-400">
                        {log.service}
                      </span>
                    </div>
                    <p className="text-sm font-mono break-words">
                      {log.message}
                    </p>
                    {log.metadata && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                          Show metadata
                        </summary>
                        <pre className="mt-2 text-xs bg-gray-900 p-2 rounded overflow-x-auto">
                          {JSON.stringify(JSON.parse(log.metadata), null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
