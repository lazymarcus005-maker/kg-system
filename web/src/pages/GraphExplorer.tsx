import { Search, PlusCircle, X } from 'lucide-react'
import { useState, useCallback, useRef, useEffect } from 'react'
import api from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import GraphVisualization from '../components/GraphVisualization'
import type { GraphNodesResponse, GraphStats, GraphNode } from '../lib/types'

interface GraphData {
  nodes: Array<{ id: string; name: string; type: string }>
  edges: Array<{ source: string; target: string; relation: string }>
  total_nodes: number
  total_edges: number
}

const NODE_LABELS = [
  'Standard', 'Clause', 'Requirement', 'Control',
  'Component', 'TestCase', 'Evidence', 'Role',
  'Process', 'Artifact', 'Constraint',
]

export default function GraphExplorer() {
  const [searchInput, setSearchInput] = useState('')
  const [results, setResults] = useState<GraphNode[]>([])
  const [searching, setSearching] = useState(false)
  const [stats, setStats] = useState<GraphStats | null>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loadingGraph, setLoadingGraph] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', label: NODE_LABELS[0], description: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (query: string) => {
    if (!query.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res = await api.get<GraphNodesResponse>('/graph/nodes', { params: { search: query, limit: 20 } })
      setResults(res.data.results)
    } catch { setResults([]) }
    finally { setSearching(false) }
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { search(value) }, 300)
  }

  const refreshStats = () => {
    api.get<GraphStats>('/graph/stats').then(r => setStats(r.data)).catch(() => {})
  }

  const loadGraphVisualization = () => {
    setLoadingGraph(true)
    api.get<GraphData>('/graph/visualization', { params: { limit: 150 } })
      .then(r => setGraphData(r.data))
      .catch(() => setGraphData(null))
      .finally(() => setLoadingGraph(false))
  }

  useEffect(() => { refreshStats(); loadGraphVisualization() }, [])

  const handleAddNode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true); setSaveError(''); setSaveSuccess('')
    try {
      await api.post('/graph/nodes', form)
      setSaveSuccess(`Node "${form.name}" created successfully`)
      setForm({ name: '', label: NODE_LABELS[0], description: '' })
      refreshStats()
      loadGraphVisualization()
      if (searchInput.trim()) search(searchInput)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setSaveError(msg ?? 'Failed to create node')
    } finally { setSaving(false) }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Graph Explorer</h1>
        <p className="text-gray-600">Visualize and explore the knowledge graph</p>
      </div>

      {/* Graph Visualization */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Knowledge Graph</h3>
        {loadingGraph && <LoadingSpinner message="Loading graph..." />}
        {!loadingGraph && graphData && (
          <>
            <GraphVisualization nodes={graphData.nodes} edges={graphData.edges} height="500px" />
            <p className="text-xs text-gray-500 mt-3">
              Showing {graphData.total_nodes} nodes and {graphData.total_edges} relationships
            </p>
          </>
        )}
      </div>

      {/* Search & Add Node */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search nodes by name..." value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={() => { setShowForm(v => !v); setSaveError(''); setSaveSuccess('') }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
            {showForm ? <X size={16} /> : <PlusCircle size={16} />}
            <span>{showForm ? 'Cancel' : 'Add Node'}</span>
          </button>
        </div>
        {showForm && (
          <form onSubmit={handleAddNode} className="p-6 border-b border-gray-200 bg-blue-50 space-y-4">
            <h4 className="font-semibold text-gray-900 text-sm">New Graph Node</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input type="text" required placeholder="e.g. ISO 26262" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type (Label) <span className="text-red-500">*</span></label>
                <select value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {NODE_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <textarea rows={2} placeholder="Optional description..." value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none" />
            </div>
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
            {saveSuccess && <p className="text-xs text-green-600">{saveSuccess}</p>}
            <button type="submit" disabled={saving || !form.name.trim()}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Creating...' : 'Create Node'}
            </button>
          </form>
        )}
        <div className="p-6">
          {searching && <LoadingSpinner message="Searching..." />}
          {!searching && searchInput && results.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-6">No nodes found</p>
          )}
          {!searching && !searchInput && (
            <p className="text-center text-sm text-gray-500 py-6">Start typing to search for nodes</p>
          )}
          {!searching && results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((node: GraphNode) => (
                <div key={node.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <p className="font-semibold text-gray-900 text-sm">{node.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {node.labels?.filter((l: string) => l !== '__Entity__').join(', ') || 'Entity'}
                  </p>
                  {node.description && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">{node.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {stats && (
          <div className="p-4 border-t border-gray-200 grid grid-cols-3 gap-4 text-sm bg-gray-50">
            <div><p className="text-gray-600">Total Nodes</p><p className="text-2xl font-bold text-gray-900">{stats.nodes.toLocaleString()}</p></div>
            <div><p className="text-gray-600">Total Relations</p><p className="text-2xl font-bold text-gray-900">{stats.relations.toLocaleString()}</p></div>
            <div><p className="text-gray-600">Documents</p><p className="text-2xl font-bold text-gray-900">{stats.documents.toLocaleString()}</p></div>
          </div>
        )}
      </div>
    </div>
  )
}
