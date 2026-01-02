import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import FlowEditor from './pages/FlowEditor'
import Flows from './pages/Flows'
import Analytics from './pages/Analytics'
import Interfaces from './pages/Interfaces'
import Settings from './pages/Settings'
import Logs from './pages/Logs'
import AudioLibrary from './pages/AudioLibrary'
import Devices from './pages/DevicesUnified'
import XBeeMonitor from './pages/XBeeMonitor'
import BluetoothMonitor from './pages/BluetoothMonitor'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/flows" element={<Flows />} />
        <Route path="/flows/new" element={<FlowEditor />} />
        <Route path="/flows/:id/edit" element={<FlowEditor />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/interfaces" element={<Interfaces />} />
        <Route path="/audio" element={<AudioLibrary />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/xbee" element={<XBeeMonitor />} />
        <Route path="/bluetooth" element={<BluetoothMonitor />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}

export default App
