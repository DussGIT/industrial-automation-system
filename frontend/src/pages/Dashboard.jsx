import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Activity, Cpu, AlertCircle, TrendingUp } from 'lucide-react'
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

export default Dashboard
