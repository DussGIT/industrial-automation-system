import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Activity, Cpu, AlertCircle, TrendingUp, RadioTower, Clock, Waves, HardDrive, MemoryStick, Monitor } from 'lucide-react'
import api from '../services/api'

const Dashboard = () => {
  const { data: flows } = useQuery({
    queryKey: ['flows'],
    queryFn: api.getFlows
  })

  const { data: stats } = useQuery({
    queryKey: ['flowStats'],
    queryFn: api.getFlowStats
  })

  const { data: radioStatus, refetch: refetchRadio } = useQuery({
    queryKey: ['radioStatus'],
    queryFn: async () => {
      const response = await api.get('/radio/status')
      return response.status
    },
    refetchInterval: 2000, // Poll every 2 seconds
    retry: false
  })

  const { data: systemStatus } = useQuery({
    queryKey: ['systemStatus'],
    queryFn: async () => {
      const data = await api.get('/system/status')
      return data
    },
    refetchInterval: 5000, // Poll every 5 seconds
    retry: false
  })

  const runningFlows = flows?.flows?.filter(f => f.status === 'running') || []
  const totalFlows = flows?.flows?.length || 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-400">System overview and status</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Activity}
          title="Running Flows"
          value={runningFlows.length}
          subtitle={`${totalFlows} total`}
          color="text-success"
        />
        <StatCard
          icon={TrendingUp}
          title="Total Executions"
          value={stats?.stats?.reduce((sum, s) => sum + s.total_executions, 0) || 0}
          subtitle="All time"
          color="text-primary"
        />
        <StatCard
          icon={Cpu}
          title="Active Interfaces"
          value="0"
          subtitle="Coming soon"
          color="text-secondary"
        />
        <StatCard
          icon={AlertCircle}
          title="Errors"
          value={stats?.stats?.reduce((sum, s) => sum + s.errors, 0) || 0}
          subtitle="Last 24h"
          color="text-error"
        />
      </div>

      {/* System Resources */}
      {systemStatus && (
        <div className="mb-8">
          <SystemResourcesWidget systemStatus={systemStatus} />
        </div>
      )}

      {/* Radio Status Widget */}
      <div className="mb-8">
        <RadioStatusWidget radioStatus={radioStatus} onRefresh={refetchRadio} />
      </div>

      {/* Recent Flows */}
      <div className="bg-dark-surface rounded-lg border border-dark-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Flows</h2>
          <Link to="/flows" className="text-primary hover:underline">
            View all
          </Link>
        </div>

        {flows?.flows?.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="mb-4">No flows created yet</p>
            <Link
              to="/flows/new"
              className="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600"
            >
              Create your first flow
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {flows?.flows?.slice(0, 5).map(flow => (
              <FlowItem key={flow.id} flow={flow} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const StatCard = ({ icon: Icon, title, value, subtitle, color }) => (
  <div className="bg-dark-surface rounded-lg border border-dark-border p-6">
    <div className="flex items-center justify-between mb-2">
      <span className="text-gray-400 text-sm">{title}</span>
      <Icon className={color} size={20} />
    </div>
    <div className="text-3xl font-bold mb-1">{value}</div>
    <div className="text-sm text-gray-500">{subtitle}</div>
  </div>
)

const FlowItem = ({ flow }) => (
  <Link
    to={`/flows/${flow.id}/edit`}
    className="block p-4 rounded-lg border border-dark-border hover:border-primary transition-colors"
  >
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-medium mb-1">{flow.name}</h3>
        <p className="text-sm text-gray-400">{flow.description || 'No description'}</p>
      </div>
      <div className="flex items-center gap-4">
        <span
          className={`px-3 py-1 rounded-full text-sm ${
            flow.status === 'running'
              ? 'bg-success/20 text-success'
              : 'bg-gray-700 text-gray-300'
          }`}
        >
          {flow.status}
        </span>
      </div>
    </div>
  </Link>
)

const RadioStatusWidget = ({ radioStatus, onRefresh }) => {
  if (!radioStatus) {
    return (
      <div className="bg-dark-surface rounded-lg border border-dark-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <RadioTower className="text-pink-500" size={24} />
          <h2 className="text-xl font-semibold">Radio Status</h2>
        </div>
        <p className="text-gray-400">Loading radio status...</p>
      </div>
    )
  }

  const { isTransmitting, currentTransmission, queue, estimatedWaitTime, stats } = radioStatus

  const formatDuration = (ms) => {
    if (!ms) return '0s'
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className="bg-dark-surface rounded-lg border border-dark-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <RadioTower className="text-pink-500" size={24} />
          <h2 className="text-xl font-semibold">Radio Status</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            <span className="font-medium text-white">{stats.totalTransmissions}</span> total broadcasts
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isTransmitting ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`}></div>
            <span className="text-sm text-gray-400">
              {isTransmitting ? 'ON AIR' : 'Idle'}
            </span>
          </div>
        </div>
      </div>

      {/* Current Transmission */}
      {currentTransmission && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Waves className="text-red-500" size={20} />
              <span className="font-medium text-red-400">Broadcasting Now</span>
            </div>
            <span className="text-sm text-gray-400">
              {formatDuration(currentTransmission.elapsed)} elapsed
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Node:</span>
              <span className="ml-2 text-white">{currentTransmission.nodeName}</span>
            </div>
            <div>
              <span className="text-gray-400">Frequency:</span>
              <span className="ml-2 text-white">{currentTransmission.frequency} MHz</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-400">Audio:</span>
              <span className="ml-2 text-white">{currentTransmission.audioFile}</span>
            </div>
          </div>
        </div>
      )}

      {/* Queue */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="text-blue-400" size={18} />
            <span className="font-medium">Queued Transmissions</span>
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs">
              {queue.length}
            </span>
          </div>
          {estimatedWaitTime > 0 && (
            <span className="text-sm text-gray-400">
              Est. wait: {formatDuration(estimatedWaitTime)}
            </span>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No transmissions queued</p>
            <p className="text-xs mt-1">Radio is ready for broadcasts</p>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map((tx, index) => (
              <div
                key={tx.id}
                className="p-3 bg-dark-bg rounded-lg border border-dark-border"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 flex items-center justify-center bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium">{tx.nodeName}</span>
                  </div>
                  <span className="text-xs text-gray-500">{tx.frequency} MHz</span>
                </div>
                <div className="text-xs text-gray-400 pl-8">
                  {tx.audioFile}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      {stats.lastTransmission && (
        <div className="mt-4 pt-4 border-t border-dark-border">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500 block text-xs">Last Broadcast</span>
              <span className="text-white">{new Date(stats.lastTransmission.timestamp).toLocaleTimeString()}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Frequency</span>
              <span className="text-white">{stats.lastTransmission.frequency} MHz</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Duration</span>
              <span className="text-white">{formatDuration(stats.lastTransmission.duration)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const SystemResourcesWidget = ({ systemStatus }) => {
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const gb = bytes / (1024 ** 3)
    return `${gb.toFixed(1)} GB`
  }

  const getUsageColor = (percent) => {
    if (percent >= 90) return 'text-red-500'
    if (percent >= 75) return 'text-yellow-500'
    return 'text-green-500'
  }

  return (
    <div className="bg-dark-surface rounded-lg border border-dark-border p-6">
      <div className="flex items-center gap-2 mb-6">
        <Monitor className="text-blue-400" size={24} />
        <h2 className="text-xl font-semibold">System Resources</h2>
        <span className="text-sm text-gray-400 ml-auto">
          {systemStatus.system?.hostname} • {systemStatus.system?.uptimeFormatted} uptime
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU Usage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="text-purple-400" size={20} />
              <span className="font-medium">CPU Usage</span>
            </div>
            <span className={`text-xl font-bold ${getUsageColor(systemStatus.cpu?.usage || 0)}`}>
              {systemStatus.cpu?.usage || 0}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                systemStatus.cpu?.usage >= 90 ? 'bg-red-500' :
                systemStatus.cpu?.usage >= 75 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${systemStatus.cpu?.usage || 0}%` }}
            />
          </div>
          <div className="text-xs text-gray-400">
            {systemStatus.cpu?.cores} cores • {systemStatus.cpu?.model?.split(' ').slice(0, 3).join(' ')}
          </div>
        </div>

        {/* Memory Usage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MemoryStick className="text-blue-400" size={20} />
              <span className="font-medium">Memory</span>
            </div>
            <span className={`text-xl font-bold ${getUsageColor(systemStatus.memory?.usagePercent || 0)}`}>
              {systemStatus.memory?.usagePercent || 0}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                systemStatus.memory?.usagePercent >= 90 ? 'bg-red-500' :
                systemStatus.memory?.usagePercent >= 75 ? 'bg-yellow-500' :
                'bg-blue-500'
              }`}
              style={{ width: `${systemStatus.memory?.usagePercent || 0}%` }}
            />
          </div>
          <div className="text-xs text-gray-400">
            {formatBytes(systemStatus.memory?.used)} / {formatBytes(systemStatus.memory?.total)}
          </div>
        </div>

        {/* Disk Usage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="text-orange-400" size={20} />
              <span className="font-medium">Disk Space</span>
            </div>
            <span className={`text-xl font-bold ${getUsageColor(systemStatus.disk?.usagePercent || 0)}`}>
              {systemStatus.disk?.usagePercent ? Math.round(systemStatus.disk.usagePercent) : 0}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                systemStatus.disk?.usagePercent >= 90 ? 'bg-red-500' :
                systemStatus.disk?.usagePercent >= 75 ? 'bg-yellow-500' :
                'bg-orange-500'
              }`}
              style={{ width: `${systemStatus.disk?.usagePercent || 0}%` }}
            />
          </div>
          <div className="text-xs text-gray-400">
            {formatBytes(systemStatus.disk?.used)} / {formatBytes(systemStatus.disk?.total)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
