import { CheckCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useHealthStore } from '../store/healthStore'
import type { HealthStatus } from '../lib/types'

export default function Settings() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const { neo4j, provider } = useHealthStore()

  useEffect(() => {
    api.get<HealthStatus>('/health')
      .then(r => setHealth(r.data))
      .catch(() => {})
  }, [])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graph-900 mb-2">Settings</h1>
        <p className="text-graph-600">System configuration and status</p>
      </div>

      <div className="space-y-8 max-w-2xl">
        {/* System Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-graph-900 mb-4">System Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-graph-50 rounded-lg">
              <span className="text-sm text-graph-700">Query API</span>
              {health && <CheckCircle size={18} className="text-green-600" />}
            </div>
            <div className="flex items-center justify-between p-3 bg-graph-50 rounded-lg">
              <span className="text-sm text-graph-700">Neo4j Database</span>
              {neo4j ? <CheckCircle size={18} className="text-green-600" /> : <span className="text-xs text-red-600">Offline</span>}
            </div>
            <div className="flex items-center justify-between p-3 bg-graph-50 rounded-lg">
              <span className="text-sm text-graph-700">LLM Provider</span>
              <span className="text-sm font-semibold text-graph-900">{provider || '—'}</span>
            </div>
          </div>
        </div>

        {/* Read-only settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-graph-900 mb-4">Configuration</h3>
          <p className="text-sm text-graph-500 mb-4">Settings are read-only and managed via environment variables.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-graph-900 mb-1">LLM Provider</label>
              <input
                type="text"
                value={provider || 'openai'}
                disabled
                className="w-full px-3 py-2 border border-graph-200 rounded-lg bg-graph-50 text-graph-600 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-graph-900 mb-1">Neo4j URI</label>
              <input
                type="text"
                value="bolt://neo4j:7687"
                disabled
                className="w-full px-3 py-2 border border-graph-200 rounded-lg bg-graph-50 text-graph-600 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-graph-900 mb-1">Qdrant Host</label>
              <input
                type="text"
                value="qdrant:6333"
                disabled
                className="w-full px-3 py-2 border border-graph-200 rounded-lg bg-graph-50 text-graph-600 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">ℹ️ Configuration</h3>
          <p className="text-sm text-blue-700">
            To modify system settings, edit the .env file and restart the services using docker-compose.
          </p>
        </div>
      </div>
    </div>
  )
}
