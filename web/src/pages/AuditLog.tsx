import { Filter, Download } from 'lucide-react'
import { useState, useEffect } from 'react'
import { readLog, exportLogAsJson } from '../lib/auditLog'
import type { AuditEntry } from '../lib/auditLog'

const TYPE_COLORS: Record<AuditEntry['type'], string> = {
  approve: 'bg-green-100 text-green-700',
  reject: 'bg-red-100 text-red-700',
  ingest: 'bg-blue-100 text-blue-700',
  merge: 'bg-purple-100 text-purple-700',
  edit: 'bg-yellow-100 text-yellow-700',
}

const ACTION_LABELS: Record<AuditEntry['type'], string> = {
  approve: 'APPROVED',
  reject: 'REJECTED',
  ingest: 'INGESTED',
  merge: 'MERGED',
  edit: 'EDITED',
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [filter, setFilter] = useState<AuditEntry['type'] | 'all'>('all')

  useEffect(() => {
    setLogs(readLog())
  }, [])

  const filteredLogs =
    filter === 'all' ? logs : logs.filter((l) => l.type === filter)

  const handleExport = () => {
    const json = exportLogAsJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kg-audit-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graph-900 mb-2">Audit Log</h1>
        <p className="text-graph-600">Track all actions and changes in the knowledge graph</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-graph-900">Activity Log</h3>
          <div className="flex space-x-2">
            <button
              onClick={handleExport}
              className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Download size={16} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2 mb-6 pb-4 border-b border-graph-200">
          <Filter size={16} className="text-graph-600" />
          <div className="flex space-x-2">
            {(['all', 'approve', 'reject', 'ingest', 'edit', 'merge'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-graph-100 text-graph-600 hover:bg-graph-200'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Log table */}
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-graph-500">
            <p className="text-sm">No audit log entries yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-graph-200">
                  <th className="text-left text-sm font-semibold text-graph-700 py-3 px-4">
                    Timestamp
                  </th>
                  <th className="text-left text-sm font-semibold text-graph-700 py-3 px-4">
                    Action
                  </th>
                  <th className="text-left text-sm font-semibold text-graph-700 py-3 px-4">
                    Entity
                  </th>
                  <th className="text-left text-sm font-semibold text-graph-700 py-3 px-4">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, idx) => (
                  <tr key={idx} className="border-b border-graph-100 hover:bg-graph-50">
                    <td className="py-3 px-4 text-sm text-graph-600 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${TYPE_COLORS[log.type]}`}
                      >
                        {ACTION_LABELS[log.type]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-graph-900 font-medium">{log.entity}</td>
                    <td className="py-3 px-4 text-sm text-graph-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Entries', count: logs.length },
          { label: 'Approvals', count: logs.filter((l) => l.type === 'approve').length },
          { label: 'Rejections', count: logs.filter((l) => l.type === 'reject').length },
          { label: 'Ingestions', count: logs.filter((l) => l.type === 'ingest').length },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-graph-600">{stat.label}</p>
            <p className="text-2xl font-bold text-graph-900 mt-1">{stat.count}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
