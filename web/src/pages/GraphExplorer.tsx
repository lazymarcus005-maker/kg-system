import { Search } from 'lucide-react'
import { useState, useCallback, useRef, useEffect } from 'react'
import api from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import type { GraphNodesResponse, GraphStats, GraphNode } from '../lib/types'

export default function GraphExplorer() {
  const [searchInput, setSearchInput] = useState('')
  const [results, setResults] = useState<GraphNode[]>([])
  const [searching, setSearching] = useState(false)
  const [stats, setStats] = useState<GraphStats | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const res = await api.get<GraphNodesResponse>('/graph/nodes', {
        params: { search: query, limit: 20 },
      })
      setResults(res.data.results)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      search(value)
    }, 300)
  }

  // Load stats on mount
  useEffect(() => {
    api.get<GraphStats>('/graph/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
  }, [])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graph-900 mb-2">Graph Explorer</h1>
        <p className="text-graph-600">Visualize and explore the knowledge graph</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-graph-200 flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-graph-400" />
            <input
              type="text"
              placeholder="Search nodes by name..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-graph-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Results */}
        <div className="p-6">
          {searching && <LoadingSpinner message="Searching..." />}
          {!searching && searchInput && results.length === 0 && (
            <p className="text-center text-sm text-graph-500 py-6">No nodes found</p>
          )}
          {!searching && !searchInput && (
            <p className="text-center text-sm text-graph-500 py-6">Start typing to search for nodes</p>
          )}
          {!searching && results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((node: GraphNode) => (
                <div key={node.id} className="border border-graph-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <p className="font-semibold text-graph-900 text-sm">{node.name}</p>
                  <p className="text-xs text-graph-500 mt-1">
                    {node.labels?.filter((l: string) => l !== '__Entity__').join(', ') || 'Entity'}
                  </p>
                  {node.description && (
                    <p className="text-xs text-graph-600 mt-2 line-clamp-2">{node.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="p-4 border-t border-graph-200 grid grid-cols-3 gap-4 text-sm bg-graph-50">
            <div>
              <p className="text-graph-600">Total Nodes</p>
              <p className="text-2xl font-bold text-graph-900">{stats.nodes.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-graph-600">Total Relations</p>
              <p className="text-2xl font-bold text-graph-900">{stats.relations.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-graph-600">Documents</p>
              <p className="text-2xl font-bold text-graph-900">{stats.documents.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
