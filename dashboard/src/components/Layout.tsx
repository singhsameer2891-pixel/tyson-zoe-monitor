import { NavLink, Outlet } from 'react-router-dom'
import { Activity, List, Shield, Settings, Video } from 'lucide-react'

const navItems = [
  { to: '/events', label: 'Events', icon: List },
  { to: '/rules', label: 'Rules', icon: Shield },
  { to: '/live', label: 'Live Feed', icon: Video },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-800 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-800">
          <Activity className="h-5 w-5 text-emerald-400" />
          <span className="font-semibold text-sm tracking-wide">CCTV Monitor</span>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-gray-800/60 text-emerald-400 border-r-2 border-emerald-400'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-600">
          Tyson & Zoe Monitor
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
