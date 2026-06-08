import { Edit2, Merge } from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import type { EntitiesResponse, OntologyResponse, Entity } from '../lib/types'

export default function EntityManagement() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [total, setTotal] = useState(0)
  const [nodeTypes, setNodeTypes] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [skip, setSkip] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const LIMIT = 50

  const fetchEntities = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string | number> = { skip, limit: LIMIT }
      if (typeFilter) params.type = typeFilter
      if (search) params.search = search
      const res = await api.get<EntitiesResponse>('/entities', { params })
      setEntities(res.data.items)
      setTotal(res.data.total)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load entities')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, search, skip])

  useEffect(() => {
    // Load ontology for type dropdown
    api.get<OntologyResponse>('/ontology')
      .then((r) => setNodeTypes(r.data.node_types.map((t) => t.name)))
      .catch(() => {/* silent */})
  }, [])

  useEffect(() => {
    fetchEntities()
  }, [fetchEntities])

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value)
      setSkip(0)
    }, 300)
  }

  const entityType = (labels: string[]) =>
    labels.find((l) => l !== '__Entity__') ?? 'Unknown'

  const totalPages = Math.ceil(total / LIMIT)
  const currentPage = Math.floor(skip / LIMIT) + 1

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graph-900 mb-2">Entity Management</h1>
        <p className="text-graph-600">Review, edit, and manage knowledge entities</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2 text-sm text-graph-500">
            <span>
              {loading ? 'Loading…' : `${total.toLocaleString()} entities`}
            </span>
          </div>
          <div className="flex space-x-2">
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setSkip(0) }}
              className="px-3 py-2 border border-graph-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {nodeTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search entities..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="px-3 py-2 border border-graph-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
          </div>
        </div>

        {error && (
          <ErrorBanner message={error} onDismiss={() => setError('')} onRetry={fetchEntities} />
        )}

        {loading ? (
          <LoadingSpinner message="Loading entities…" />
        ) : entities.length === 0 ? (
          <div className="text-center py-12 text-graph-500">
            <p className="text-sm">No entities found matching your criteria</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-graph-200">
                    <th className="text-left text-sm font-semibold text-graph-700 py-3 px-4">Entity Name</th>
                    <th className="text-left text-sm font-semibold text-graph-700 py-3 px-4">Type</th>
                    <th className="text-left text-sm font-semibold text-graph-700 py-3 px-4">Description</th>
                    <th className="text-left text-sm font-semibold text-graph-700 py-3 px-4">Status</th>
                    <th className="text-center text-sm font-semibold text-graph-700 py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map((entity) => (
                    <tr key={entity.id} className="border-b border-graph-100 hover:bg-graph-50">
                      <td className="py-3 px-4 text-sm font-medium text-graph-900">{entity.name}</td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {entityType(entity.labels)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-graph-600 max-w-xs truncate" title={entity.description}>
                        {entity.description ?? '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                          entity.status === 'verified'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {entity.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            className="p-1 hover:bg-graph-100 rounded transition-colors"
                            title="Edit (not yet implemented)"
                            disabled
                          >
                            <Edit2 size={16} className="text-graph-400" />
                          </button>
                          <button
                            className="p-1 hover:bg-graph-100 rounded transition-colors"
                            title="Merge (not yet implemented)"
                            disabled
                          >
                            <Merge size={16} className="text-graph-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-graph-100">
                <span className="text-sm text-graph-500">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSkip(Math.max(0, skip - LIMIT))}
                    disabled={skip === 0}
                    className="px-3 py-1 text-sm border border-graph-200 rounded hover:bg-graph-50 disabled:opacity-40"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setSkip(skip + LIMIT)}
                    disabled={skip + LIMIT >= total}
                    className="px-3 py-1 text-sm border border-graph-200 rounded hover:bg-graph-50 disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
