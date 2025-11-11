import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Workflow, BarChart3, Settings, Cpu } from 'lucide-react'

const Layout = ({ children }) => {
  const location = useLocation()

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/flows', icon: Workflow, label: 'Flows' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/interfaces', icon: Cpu, label: 'Interfaces' },
    { path: '/settings', icon: Settings, label: 'Settings' }
  ]

  return (
    <div className="flex h-screen bg-dark-bg">
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
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

export default Layout
