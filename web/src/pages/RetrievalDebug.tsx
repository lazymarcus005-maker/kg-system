import { Code2, Clock } from 'lucide-react'
import { useState } from 'react'
import api from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import type { CypherResponse } from '../lib/types'

export default function RetrievalDebug() {
  const [query, setQuery] = useState('')
  const [cypher, setCypher] = useState('')
  const [results, setResults] = useState<unknown[]>([])
  const [latencyMs, setLatencyMs] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDebug = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    const t0 = Date.now()
    try {
      const res = await api.post<CypherResponse>('/query/cypher', {
        question: query,
      })
      setLatencyMs(Date.now() - t0)
      setCypher(res.data.cypher)
      setResults(res.data.results)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Debug failed')
      setCypher('')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graph-900 mb-2">Retrieval Debug</h1>
        <p className="text-graph-600">Debug and analyze retrieval pipeline performance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-graph-900 mb-4">Test Query</h3>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your test query..."
              className="w-full px-3 py-2 border border-graph-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              rows={4}
            />
            <button
              onClick={handleDebug}
              disabled={loading || !query.trim()}
              className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              Debug Query
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-graph-900 mb-4">Metrics</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-graph-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Clock size={18} className="text-graph-600" />
                  <span className="text-sm text-graph-700">Query Time</span>
                </div>
                <span className="font-semibold text-graph-900">
                  {latencyMs > 0 ? `${latencyMs}ms` : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Results panel */}
        <div className="lg:col-span-2 space-y-6">
          {error && (
            <ErrorBanner message={error} onDismiss={() => setError('')} />
          )}

          {loading ? (
            <LoadingSpinner message="Executing query..." />
          ) : (
            <>
              {cypher && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-graph-900 mb-4 flex items-center space-x-2">
                    <Code2 size={20} />
                    <span>Generated Cypher Query</span>
                  </h3>
                  <pre className="bg-graph-900 text-graph-100 p-4 rounded-lg font-mono text-sm overflow-x-auto whitespace-pre-wrap break-all">
                    {cypher}
                  </pre>
                </div>
              )}

              {results.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-graph-900 mb-4">
                    Results
                    <span className="ml-2 text-sm font-normal text-graph-500">({results.length} rows)</span>
                  </h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {results.map((result, idx) => (
                      <div key={idx} className="border border-graph-200 rounded-lg p-3 bg-graph-50">
                        <pre className="font-mono text-xs whitespace-pre-wrap break-all text-graph-700">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!loading && !cypher && (
                <div className="bg-white rounded-lg shadow p-6 text-center py-12">
                  <p className="text-sm text-graph-500">Enter a query and click "Debug Query" to see results</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
