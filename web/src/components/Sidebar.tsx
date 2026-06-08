import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Network,
  Users,
  Link2,
  MessageSquare,
  Search,
  Activity,
  Download,
  Layers,
  History,
  Settings,
} from 'lucide-react'
import clsx from 'clsx'

const navigation = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Documents / Ingestion', path: '/documents', icon: FileText },
  { name: 'Graph Explorer', path: '/graph-explorer', icon: Network },
  { name: 'Entity Management', path: '/entities', icon: Users },
  { name: 'Relation Review', path: '/relations', icon: Link2 },
  { name: 'Ask / Chat', path: '/chat', icon: MessageSquare },
  { name: 'Retrieval Debug', path: '/debug', icon: Search },
  { name: 'API / MCP Monitor', path: '/monitor', icon: Activity },
  { name: 'Import / Export', path: '/import-export', icon: Download },
  { name: 'Ontology Management', path: '/ontology', icon: Layers },
  { name: 'Audit Log', path: '/audit', icon: History },
  { name: 'Settings', path: '/settings', icon: Settings },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <div className="w-64 bg-graph-900 text-white flex flex-col h-screen">
      <div className="p-6 border-b border-graph-800">
        <h1 className="text-2xl font-bold">KG System</h1>
        <p className="text-sm text-graph-400">Control Panel</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-graph-700 text-white'
                  : 'text-graph-300 hover:bg-graph-800'
              )}
            >
              <Icon size={20} />
              <span className="text-sm font-medium">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-graph-800">
        <div className="text-xs text-graph-400">
          <p>v0.1.0</p>
        </div>
      </div>
    </div>
  )
}
