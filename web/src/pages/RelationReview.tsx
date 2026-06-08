import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { logEvent } from '../lib/auditLog'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import type { Relation, RelationsResponse, RelationCounts } from '../lib/types'

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all'

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

export default function RelationReview() {
  const [relations, setRelations] = useState<Relation[]>([])
  const [counts, setCounts] = useState<RelationCounts>({ pending: 0, approved: 0, rejected: 0 })
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  const fetchRelations = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = {}
      if (filter !== 'all') params.status = filter
      const res = await api.get<RelationsResponse>('/relations', { params })
      setRelations(res.data.items)
      setCounts(res.data.counts)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load relations')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchRelations()
  }, [fetchRelations])

  const updateStatus = async (rel: Relation, newStatus: 'approved' | 'rejected') => {
    const encodedId = encodeURIComponent(rel.id)
    setProcessingIds((prev) => new Set(prev).add(rel.id))
    try {
      await api.patch(`/relations/${encodedId}`, { status: newStatus })

      // Log audit event
      logEvent({
        type: newStatus === 'approved' ? 'approve' : 'reject',
        action: newStatus.toUpperCase(),
        entity: `Relation: ${rel.source_name} → ${rel.target_name}`,
        details: `${rel.relation_type} | confidence: ${rel.confidence?.toFixed(2) ?? 'n/a'}`,
      })

      // Optimistic: remove from current list (filter will not show it anymore)
      setRelations((prev) => prev.filter((r) => r.id !== rel.id))
      setCounts((prev) => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
        [newStatus]: prev[newStatus] + 1,
      }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(rel.id)
        return next
      })
    }
  }

  const total = counts.pending + counts.approved + counts.rejected

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graph-900 mb-2">Relation Review</h1>
        <p className="text-graph-600">Approve or reject AI-extracted relationships</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar counts */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-graph-900 mb-4">Review Status</h3>
            <div className="space-y-3">
              {[
                { label: 'Pending Review', count: counts.pending, color: 'bg-yellow-100', key: 'pending' },
                { label: 'Approved', count: counts.approved, color: 'bg-green-100', key: 'approved' },
                { label: 'Rejected', count: counts.rejected, color: 'bg-red-100', key: 'rejected' },
                { label: 'Total', count: total, color: 'bg-blue-100', key: 'all' },
              ].map((stat) => (
                <button
                  key={stat.key}
                  onClick={() => setFilter(stat.key as StatusFilter)}
                  className={`w-full text-left p-4 rounded-lg ${stat.color} ${
                    filter === stat.key ? 'ring-2 ring-blue-500' : ''
                  } transition-all`}
                >
                  <p className="text-sm text-graph-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-graph-900">{stat.count}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Relations list */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-graph-900">
                {FILTER_LABELS[filter]} Relations
              </h3>
              <div className="flex space-x-2">
                {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      filter === f
                        ? 'bg-blue-600 text-white'
                        : 'bg-graph-100 text-graph-600 hover:bg-graph-200'
                    }`}
                  >
                    {FILTER_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <ErrorBanner message={error} onDismiss={() => setError('')} onRetry={fetchRelations} />
            )}

            {loading ? (
              <LoadingSpinner message="Loading relations…" />
            ) : relations.length === 0 ? (
              <div className="text-center py-12 text-graph-500">
                <p className="text-sm">No {filter !== 'all' ? filter : ''} relations found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {relations.map((rel) => {
                  const isProcessing = processingIds.has(rel.id)
                  return (
                    <div
                      key={rel.id}
                      className={`border border-graph-200 rounded-lg p-4 transition-all ${
                        isProcessing ? 'opacity-50 pointer-events-none' : 'hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-graph-900">
                            <span className="text-blue-600">{rel.source_name}</span>
                            {' '}→{' '}
                            <span className="text-green-600">{rel.target_name}</span>
                          </p>
                          <p className="text-sm text-graph-600 mt-1">
                            <span className="inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-semibold">
                              {rel.relation_type}
                            </span>
                            {rel.status !== 'pending' && (
                              <span className={`ml-2 inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                rel.status === 'approved'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {rel.status}
                              </span>
                            )}
                          </p>
                          {rel.evidence && (
                            <p className="text-xs text-graph-500 mt-2 truncate" title={rel.evidence}>
                              Evidence: {rel.evidence}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-4 flex-shrink-0">
                          <p className="text-sm font-semibold text-graph-900">
                            {rel.confidence != null ? `${(rel.confidence * 100).toFixed(0)}%` : '—'}
                          </p>
                          <p className="text-xs text-graph-500">confidence</p>
                        </div>
                      </div>
                      {(rel.status as string) === 'pending' && (
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => updateStatus(rel, 'approved')}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors text-sm font-medium"
                          >
                            <ThumbsUp size={15} />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => updateStatus(rel, 'rejected')}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors text-sm font-medium"
                          >
                            <ThumbsDown size={15} />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
