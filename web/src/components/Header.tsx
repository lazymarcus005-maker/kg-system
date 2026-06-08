import { Bell, HelpCircle } from 'lucide-react'

export default function Header() {
  return (
    <header className="bg-white border-b border-graph-200 px-8 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-semibold text-graph-900">Knowledge Graph System</h2>
        <p className="text-sm text-graph-500">Control panel for managing KG operations</p>
      </div>
      <div className="flex items-center space-x-4">
        <button className="p-2 hover:bg-graph-100 rounded-lg transition-colors">
          <HelpCircle size={20} className="text-graph-600" />
        </button>
        <button className="p-2 hover:bg-graph-100 rounded-lg transition-colors relative">
          <Bell size={20} className="text-graph-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="w-10 h-10 bg-graph-200 rounded-full flex items-center justify-center">
          <span className="text-sm font-semibold text-graph-700">U</span>
        </div>
      </div>
    </header>
  )
}
