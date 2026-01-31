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
import Cameras from './pages/Cameras'
import UnknownEvents from './pages/UnknownEvents'

function App() {
  return (
    <Routes>
      {/* Flow Editor routes without Layout */}
      <Route path="/flows/new" element={<FlowEditor />} />
      <Route path="/flows/:id/edit" element={<FlowEditor />} />
      
      {/* All other routes with Layout */}
      <Route path="/" element={<Layout><Dashboard /></Layout>} />
      <Route path="/flows" element={<Layout><Flows /></Layout>} />
      <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
      <Route path="/interfaces" element={<Layout><Interfaces /></Layout>} />
      <Route path="/audio" element={<Layout><AudioLibrary /></Layout>} />
      <Route path="/devices" element={<Layout><Devices /></Layout>} />
      <Route path="/cameras" element={<Layout><Cameras /></Layout>} />
      <Route path="/unknown-events" element={<Layout><UnknownEvents /></Layout>} />
      <Route path="/xbee" element={<Layout><XBeeMonitor /></Layout>} />
      <Route path="/bluetooth" element={<Layout><BluetoothMonitor /></Layout>} />
      <Route path="/logs" element={<Layout><Logs /></Layout>} />
      <Route path="/settings" element={<Layout><Settings /></Layout>} />
    </Routes>
  )
}

export default App
