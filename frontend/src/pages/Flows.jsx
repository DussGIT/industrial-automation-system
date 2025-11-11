import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Play, Square, Trash2 } from 'lucide-react'
import api from '../services/api'

const Flows = () => {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['flows'],
    queryFn: api.getFlows
  })

  const startMutation = useMutation({
    mutationFn: api.startFlow,
    onSuccess: () => queryClient.invalidateQueries(['flows'])
  })

  const stopMutation = useMutation({
    mutationFn: api.stopFlow,
    onSuccess: () => queryClient.invalidateQueries(['flows'])
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteFlow,
    onSuccess: () => queryClient.invalidateQueries(['flows'])
  })

  if (isLoading) {
    return <div className="p-8">Loading...</div>
  }

  const flows = data?.flows || []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Flows</h1>
          <p className="text-gray-400">Manage your automation workflows</p>
        </div>
        <Link
          to="/flows/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600"
        >
          <Plus size={20} />
          Create Flow
        </Link>
      </div>

      {flows.length === 0 ? (
        <div className="bg-dark-surface rounded-lg border border-dark-border p-12 text-center">
          <p className="text-gray-400 mb-4">No flows created yet</p>
          <Link
            to="/flows/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600"
          >
            <Plus size={20} />
            Create your first flow
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {flows.map(flow => (
            <div
              key={flow.id}
              className="bg-dark-surface rounded-lg border border-dark-border p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{flow.name}</h3>
                  <p className="text-gray-400 text-sm mb-2">
                    {flow.description || 'No description'}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Created: {new Date(flow.created_at * 1000).toLocaleDateString()}</span>
                    <span
                      className={`px-2 py-1 rounded ${
                        flow.status === 'running'
                          ? 'bg-success/20 text-success'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {flow.status}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Link
                    to={`/flows/${flow.id}/edit`}
                    className="px-4 py-2 bg-dark-bg text-white rounded-lg hover:bg-gray-700"
                  >
                    Edit
                  </Link>
                  
                  {flow.status === 'running' ? (
                    <button
                      onClick={() => stopMutation.mutate(flow.id)}
                      className="p-2 bg-warning text-white rounded-lg hover:bg-yellow-600"
                      title="Stop"
                    >
                      <Square size={20} />
                    </button>
                  ) : (
                    <button
                      onClick={() => startMutation.mutate(flow.id)}
                      className="p-2 bg-success text-white rounded-lg hover:bg-green-600"
                      title="Start"
                    >
                      <Play size={20} />
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this flow?')) {
                        deleteMutation.mutate(flow.id)
                      }
                    }}
                    className="p-2 bg-error text-white rounded-lg hover:bg-red-600"
                    title="Delete"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Flows
