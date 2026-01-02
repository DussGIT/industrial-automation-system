import React, { useState, useCallback, useRef, useEffect } from 'react'
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Play, Square, Save, Upload, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

import CustomNode from '../components/flow/CustomNode'
import NodePalette from '../components/flow/NodePalette'
import NodeConfigPanel from '../components/flow/NodeConfigPanel'
import DebugPanel from '../components/flow/DebugPanel'

const nodeTypes = {
  custom: CustomNode,
}

let id = 0
const getId = () => `node_${id++}`

const FlowEditor = () => {
  const { id: flowId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const reactFlowWrapper = useRef(null)
  const [reactFlowInstance, setReactFlowInstance] = useState(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [flowName, setFlowName] = useState('Untitled Flow')
  const [isRunning, setIsRunning] = useState(false)
  const [currentFlowId, setCurrentFlowId] = useState(flowId || 'new')
  const [saveMessage, setSaveMessage] = useState(null)

  // Update currentFlowId when URL parameter changes
  useEffect(() => {
    setCurrentFlowId(flowId || 'new')
  }, [flowId])

  // Load flow data if editing existing flow
  const { data: flowData, isLoading: flowLoading, error: flowError } = useQuery({
    queryKey: ['flow', currentFlowId],
    queryFn: async () => {
      if (!currentFlowId || currentFlowId === 'new') return null
      console.log('Fetching flow:', currentFlowId)
      const response = await api.getFlow(currentFlowId)
      console.log('Flow API response:', response)
      return response.flow
    },
    enabled: !!currentFlowId && currentFlowId !== 'new',
  })

  console.log('Current flow ID:', currentFlowId)
  console.log('Flow data:', flowData)
  console.log('Flow loading:', flowLoading)
  console.log('Flow error:', flowError)

  // Define handleNodeTrigger before it's used in useEffect
  const handleNodeTrigger = useCallback(async (nodeId) => {
    if (!currentFlowId || currentFlowId === 'new') {
      alert('Please save the flow before triggering nodes')
      return
    }
    
    try {
      console.log('Triggering node:', nodeId)
      const response = await api.post(`/flows/${currentFlowId}/trigger/${nodeId}`)
      console.log('Trigger response:', response)
      
      // Show success message
      setSaveMessage({ type: 'success', text: 'Node triggered!' })
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (error) {
      console.error('Trigger error:', error)
      setSaveMessage({ type: 'error', text: 'Failed to trigger node' })
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }, [currentFlowId])

  useEffect(() => {
    if (flowData) {
      console.log('Loading flow data:', flowData)
      setFlowName(flowData.name || 'Untitled Flow')
      
      // Convert backend node format to ReactFlow format
      if (flowData.nodes) {
        console.log('Flow nodes:', flowData.nodes)
        const reactFlowNodes = flowData.nodes.map(node => ({
          id: node.id,
          type: 'custom',
          position: node.position || { x: 0, y: 0 },
          data: {
            type: node.type,
            label: node.config?.name || node.type,
            config: node.config || {},
            onTrigger: handleNodeTrigger,
          },
        }))
        console.log('ReactFlow nodes:', reactFlowNodes)
        setNodes(reactFlowNodes)
      }
      
      if (flowData.edges) {
        console.log('Flow edges:', flowData.edges)
        setEdges(flowData.edges)
      }
      
      setIsRunning(flowData.status === 'running')
    }
  }, [flowData, setNodes, setEdges, handleNodeTrigger])

  // Save flow mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate flow name
      if (!flowName || flowName.trim() === '') {
        throw new Error('Flow name is required')
      }

      const flowDefinition = {
        name: flowName.trim(),
        description: `Created ${new Date().toLocaleDateString()}`,
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.data.type,
          position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
          config: node.data.config || {},
        })),
        edges: edges,
        status: isRunning ? 'running' : 'stopped',
      }

      console.log('Saving flow definition:', flowDefinition)

      if (currentFlowId && currentFlowId !== 'new') {
        return await api.updateFlow(currentFlowId, flowDefinition)
      } else {
        return await api.createFlow(flowDefinition)
      }
    },
    onSuccess: (response) => {
      console.log('Save response:', response)
      setSaveMessage({ type: 'success', text: 'Flow saved successfully!' })
      setTimeout(() => setSaveMessage(null), 3000)
      
      queryClient.invalidateQueries(['flows'])
      
      // If this was a new flow, update the flow ID and URL
      if (currentFlowId === 'new' && response?.flowId) {
        console.log('Updating flow ID from new to:', response.flowId)
        setCurrentFlowId(response.flowId)
        navigate(`/flows/${response.flowId}/edit`, { replace: true })
        queryClient.invalidateQueries(['flow', response.flowId])
      } else if (currentFlowId) {
        queryClient.invalidateQueries(['flow', currentFlowId])
      }
    },
    onError: (error) => {
      console.error('Save error:', error)
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to save flow'
      setSaveMessage({ type: 'error', text: errorMessage })
      setTimeout(() => setSaveMessage(null), 5000)
    },
  })

  // Deploy/Stop flow mutation
  const deployMutation = useMutation({
    mutationFn: async (action) => {
      if (!currentFlowId || currentFlowId === 'new') {
        throw new Error('Please save the flow first')
      }
      if (action === 'start') {
        return await api.startFlow(currentFlowId)
      } else {
        return await api.stopFlow(currentFlowId)
      }
    },
    onSuccess: (response, action) => {
      console.log('Deploy response:', response)
      setIsRunning(action === 'start')
      setSaveMessage({ 
        type: 'success', 
        text: action === 'start' ? 'Flow deployed!' : 'Flow stopped!' 
      })
      setTimeout(() => setSaveMessage(null), 3000)
      
      queryClient.invalidateQueries(['flows'])
      queryClient.invalidateQueries(['flow', currentFlowId])
    },
    onError: (error) => {
      console.error('Deploy error:', error)
      setSaveMessage({ type: 'error', text: error.message || 'Failed to deploy flow' })
      setTimeout(() => setSaveMessage(null), 5000)
    },
  })

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow')
      const label = event.dataTransfer.getData('nodeLabel')

      if (typeof type === 'undefined' || !type) {
        return
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newNode = {
        id: getId(),
        type: 'custom',
        position,
        data: { 
          type,
          label,
          config: {},
          onTrigger: handleNodeTrigger,
        },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [reactFlowInstance, setNodes]
  )

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node)
  }, [])

  const onNodeDoubleClick = useCallback((event, node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const onNodesDelete = useCallback((deleted) => {
    // Close config panel if the deleted node was selected
    if (selectedNode && deleted.some(node => node.id === selectedNode.id)) {
      setSelectedNode(null)
    }
  }, [selectedNode])

  const handleDeleteNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id))
      setEdges((eds) => eds.filter((edge) => 
        edge.source !== selectedNode.id && edge.target !== selectedNode.id
      ))
      setSelectedNode(null)
    }
  }, [selectedNode, setNodes, setEdges])

  const handleConfigSave = useCallback((nodeId, config) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              config,
              label: config.name || node.data.label,
            },
          }
        }
        return node
      })
    )
  }, [setNodes])

  const handleSave = () => {
    saveMutation.mutate()
  }

  const handleDeploy = () => {
    if (isRunning) {
      deployMutation.mutate('stop')
    } else {
      deployMutation.mutate('start')
    }
  }

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the flow?')) {
      setNodes([])
      setEdges([])
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Notification Banner */}
      {saveMessage && (
        <div className={`px-4 py-3 flex items-center gap-2 ${
          saveMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        } text-white`}>
          {saveMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          <span>{saveMessage.text}</span>
        </div>
      )}
      
      {/* Toolbar */}
      <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Flow name"
          />
          <span className="text-sm text-gray-400">
            {nodes.length} nodes, {edges.length} connections
            {currentFlowId !== 'new' && ` • ID: ${currentFlowId.slice(0, 8)}...`}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedNode && (
            <button
              onClick={handleDeleteNode}
              className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center gap-2"
              title="Delete selected node (or press Delete/Backspace)"
            >
              <Trash2 className="w-4 h-4" />
              Delete Node
            </button>
          )}
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleDeploy}
            disabled={deployMutation.isPending || !currentFlowId || currentFlowId === 'new'}
            className={`px-3 py-1.5 text-white text-sm rounded transition-colors flex items-center gap-2 disabled:opacity-50 ${
              isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
            title={currentFlowId === 'new' ? 'Save the flow first before deploying' : ''}
          >
            {isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {deployMutation.isPending ? 'Processing...' : isRunning ? 'Stop' : 'Deploy'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        <NodePalette />
        
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onPaneClick={onPaneClick}
            onNodesDelete={onNodesDelete}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            className="bg-gray-900"
          >
            <Controls className="bg-gray-800 border border-gray-700" />
            <MiniMap 
              className="bg-gray-800 border border-gray-700"
              nodeColor={(node) => {
                const colors = {
                  inject: '#3b82f6',
                  debug: '#6b7280',
                  function: '#f97316',
                  'mqtt-in': '#a855f7',
                  'mqtt-out': '#a855f7',
                  'zigbee-button': '#eab308',
                  'camera-event': '#ef4444',
                }
                return colors[node.data.type] || '#6b7280'
              }}
            />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#374151" />
          </ReactFlow>
        </div>
      </div>

      {/* Config Panel */}
      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onSave={handleConfigSave}
        />
      )}

      {/* Debug Panel */}
      <DebugPanel flowId={currentFlowId} />
    </div>
  )
}

export default FlowEditor
