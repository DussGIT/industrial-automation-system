import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import FlowEditor from './pages/FlowEditor'
import Flows from './pages/Flows'
import Analytics from './pages/Analytics'
import Interfaces from './pages/Interfaces'
import Settings from './pages/Settings'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/flows" element={<Flows />} />
        <Route path="/flows/:id/edit" element={<FlowEditor />} />
        <Route path="/flows/new" element={<FlowEditor />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/interfaces" element={<Interfaces />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}

export default App
