import { Download, FileJson } from 'lucide-react'
import { useState } from 'react'
import api from '../lib/api'
import type { CypherResponse } from '../lib/types'

export default function ImportExport() {
  const [exporting, setExporting] = useState(false)

  const handleExportJson = async () => {
    setExporting(true)
    try {
      const res = await api.post<CypherResponse>('/run/cypher', {
        cypher: 'MATCH (n)-[r]->(m) RETURN n, type(r) AS rel, m LIMIT 1000',
      })
      const blob = new Blob([JSON.stringify(res.data.results, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kg-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Export failed: ' + (e instanceof Error ? e.message : 'Unknown error'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graph-900 mb-2">Import / Export</h1>
        <p className="text-graph-600">Backup and export knowledge graph data</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Export */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Download size={24} className="text-blue-600" />
            <h3 className="text-lg font-semibold text-graph-900">Export Data</h3>
          </div>
          <p className="text-sm text-graph-600 mb-4">
            Export knowledge graph data in JSON format
          </p>
          <button
            onClick={handleExportJson}
            disabled={exporting}
            className="w-full px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-left flex items-center space-x-2 font-medium disabled:opacity-50"
          >
            <FileJson size={18} />
            <span>{exporting ? 'Exporting…' : 'Export as JSON'}</span>
          </button>
          <p className="text-xs text-graph-500 mt-3">
            Exports all entities and relations up to 1000 rows as JSON
          </p>
        </div>

        {/* Import disabled */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Download size={24} className="text-green-600 rotate-180" />
            <h3 className="text-lg font-semibold text-graph-900">Import Data</h3>
          </div>
          <p className="text-sm text-graph-600 mb-4">
            Import data from backup files
          </p>
          <div className="border-2 border-dashed border-graph-200 rounded-lg p-8 text-center bg-graph-50">
            <p className="text-sm text-graph-500">Coming soon</p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">ℹ️ Full Backups</h3>
        <p className="text-sm text-blue-700">
          For complete system backups, use docker-compose to export Neo4j and Qdrant volumes.
        </p>
      </div>
    </div>
  )
}
