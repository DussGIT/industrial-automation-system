import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

const api = {
  // Flows
  getFlows: async () => {
    const { data } = await apiClient.get('/flows')
    return data
  },

  getFlow: async (id) => {
    const { data } = await apiClient.get(`/flows/${id}`)
    return data
  },

  createFlow: async (flowData) => {
    const { data } = await apiClient.post('/flows', flowData)
    return data
  },

  updateFlow: async (id, flowData) => {
    const { data } = await apiClient.put(`/flows/${id}`, flowData)
    return data
  },

  deleteFlow: async (id) => {
    const { data } = await apiClient.delete(`/flows/${id}`)
    return data
  },

  startFlow: async (id) => {
    const { data } = await apiClient.post(`/flows/${id}/start`)
    return data
  },

  stopFlow: async (id) => {
    const { data } = await apiClient.post(`/flows/${id}/stop`)
    return data
  },

  getFlowStatus: async (id) => {
    const { data } = await apiClient.get(`/flows/${id}/status`)
    return data
  },

  // Nodes
  getNodeTypes: async () => {
    const { data } = await apiClient.get('/nodes')
    return data
  },

  // Analytics
  getFlowExecutions: async (params = {}) => {
    const { data } = await apiClient.get('/analytics/executions', { params })
    return data
  },

  getMetrics: async (params = {}) => {
    const { data } = await apiClient.get('/analytics/metrics', { params })
    return data
  },

  getFlowStats: async () => {
    const { data } = await apiClient.get('/analytics/flows/stats')
    return data
  },

  getLogs: async (params = {}) => {
    const { data } = await apiClient.get('/analytics/logs', { params })
    return data
  },

  // Interfaces
  getInterfaces: async () => {
    const { data } = await apiClient.get('/interfaces')
    return data
  },

  getInterface: async (id) => {
    const { data } = await apiClient.get(`/interfaces/${id}`)
    return data
  },

  createInterface: async (interfaceData) => {
    const { data } = await apiClient.post('/interfaces', interfaceData)
    return data
  },

  deleteInterface: async (id) => {
    const { data } = await apiClient.delete(`/interfaces/${id}`)
    return data
  },

  getInterfaceTypes: async () => {
    const { data } = await apiClient.get('/interfaces/types')
    return data
  }
}

export default api
