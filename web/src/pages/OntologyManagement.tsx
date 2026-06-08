import { Edit2, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import type { OntologyResponse, OntologyType } from '../lib/types'

const TYPE_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-yellow-100 text-yellow-700',
  'bg-red-100 text-red-700',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700',
  'bg-orange-100 text-orange-700',
]

export default function OntologyManagement() {
  const [nodeTypes, setNodeTypes] = useState<OntologyType[]>([])
  const [relTypes, setRelTypes] = useState<OntologyType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchOntology = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<OntologyResponse>('/ontology')
      setNodeTypes(res.data.node_types)
      setRelTypes(res.data.relation_types)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load ontology')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOntology()
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-graph-900 mb-2">Ontology Management</h1>
        <LoadingSpinner message="Loading ontology…" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graph-900 mb-2">Ontology Management</h1>
        <p className="text-graph-600">Manage node types and relation types in the knowledge graph</p>
      </div>

      {error && (
        <ErrorBanner message={error} onDismiss={() => setError('')} onRetry={fetchOntology} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Node Types */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-graph-900">Node Types</h3>
            <span className="text-sm text-graph-500">{nodeTypes.length} types</span>
          </div>
          {nodeTypes.length === 0 ? (
            <p className="text-sm text-graph-500 py-4 text-center">No node types found yet — ingest documents to populate</p>
          ) : (
            <div className="space-y-2">
              {nodeTypes.map((t, idx) => (
                <div
                  key={t.name}
                  className={`p-4 rounded-lg flex items-center justify-between ${
                    TYPE_COLORS[idx % TYPE_COLORS.length]
                  }`}
                >
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-sm opacity-75">{t.count.toLocaleString()} nodes</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      className="p-1 hover:opacity-75 transition-opacity"
                      title="Edit (not yet implemented)"
                      disabled
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="p-1 hover:opacity-75 transition-opacity"
                      title="Delete (not yet implemented)"
                      disabled
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Relation Types */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-graph-900">Relation Types</h3>
            <span className="text-sm text-graph-500">{relTypes.length} types</span>
          </div>
          {relTypes.length === 0 ? (
            <p className="text-sm text-graph-500 py-4 text-center">No relation types found yet — ingest documents to populate</p>
          ) : (
            <div className="space-y-2">
              {relTypes.map((t) => (
                <div
                  key={t.name}
                  className="p-4 rounded-lg border border-graph-200 flex items-center justify-between hover:bg-graph-50"
                >
                  <div>
                    <p className="font-semibold text-graph-900 font-mono text-sm">{t.name}</p>
                    <p className="text-sm text-graph-600">{t.count.toLocaleString()} relations</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      className="p-1 hover:bg-graph-100 rounded transition-colors"
                      title="Edit (not yet implemented)"
                      disabled
                    >
                      <Edit2 size={16} className="text-graph-400" />
                    </button>
                    <button
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                      title="Delete (not yet implemented)"
                      disabled
                    >
                      <Trash2 size={16} className="text-graph-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <h3 className="text-lg font-semibold text-graph-900 mb-4">Ontology Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-graph-50 rounded-lg">
            <p className="text-xs text-graph-600">Total Node Types</p>
            <p className="text-2xl font-bold text-graph-900 mt-1">{nodeTypes.length}</p>
          </div>
          <div className="p-4 bg-graph-50 rounded-lg">
            <p className="text-xs text-graph-600">Total Relation Types</p>
            <p className="text-2xl font-bold text-graph-900 mt-1">{relTypes.length}</p>
          </div>
          <div className="p-4 bg-graph-50 rounded-lg">
            <p className="text-xs text-graph-600">Total Nodes</p>
            <p className="text-2xl font-bold text-graph-900 mt-1">
              {nodeTypes.reduce((s, t) => s + t.count, 0).toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-graph-50 rounded-lg">
            <p className="text-xs text-graph-600">Total Relations</p>
            <p className="text-2xl font-bold text-graph-900 mt-1">
              {relTypes.reduce((s, t) => s + t.count, 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
