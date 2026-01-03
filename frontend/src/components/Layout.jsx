import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Workflow, BarChart3, Settings, Cpu as CpuIcon, FileText, Volume2, Radio, Wifi, Bluetooth, Cpu } from 'lucide-react'
import GPIOMonitor from './GPIOMonitor'

const Layout = ({ children }) => {
  const location = useLocation()
  const [showGPIOMonitor, setShowGPIOMonitor] = useState(false)

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/flows', icon: Workflow, label: 'Flows' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/interfaces', icon: CpuIcon, label: 'Interfaces' },
    { path: '/devices', icon: Radio, label: 'Devices' },
    { path: '/xbee', icon: Wifi, label: 'XBee Monitor' },
    { path: '/bluetooth', icon: Bluetooth, label: 'Bluetooth' },
    { path: '/audio', icon: Volume2, label: 'Audio Library' },
    { path: '/logs', icon: FileText, label: 'Logs' },
    { path: '/settings', icon: Settings, label: 'Settings' }
  ]

  return (
    <div className="flex h-screen bg-dark-bg">
      {/* GPIO Monitor Floating Button */}
      {!showGPIOMonitor && (
        <button
          onClick={() => setShowGPIOMonitor(true)}
          className="fixed bottom-24 right-4 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl z-40 transition-all hover:scale-110"
          title="Open GPIO Monitor"
        >
          <Cpu className="w-6 h-6" />
        </button>
      )}

      {/* GPIO Monitor Panel */}
      {showGPIOMonitor && (
        <GPIOMonitor onClose={() => setShowGPIOMonitor(false)} />
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-dark-surface border-r border-dark-border">
        <div className="p-4 border-b border-dark-border">
          <h1 className="text-2xl font-bold text-primary">IA System</h1>
          <p className="text-sm text-gray-400">Industrial Automation</p>
        </div>
        
        <nav className="p-4 space-y-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-gray-300 hover:bg-dark-bg'
                }`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 overflow-auto">
          {children}
        </main>
        
        {/* Footer */}
        <footer className="bg-dark-surface border-t border-dark-border py-2 px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 h-12">
              <img 
                src="/assets/duss-logo.png?v=2" 
                alt="DussTech Logo" 
                className="h-full object-contain"
              />
            </div>
            <div className="text-sm text-gray-400">
              © {new Date().getFullYear()} Albert Dussinger. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default Layout
