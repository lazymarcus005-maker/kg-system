import { CheckCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '../lib/api'
import ingestionApi from '../lib/ingestionApi'
import { useHealthStore } from '../store/healthStore'
import type { HealthStatus } from '../lib/types'

interface RuntimeConfig {
  llm: {
    provider: string
    openai_compatible_base_url: string
    openai_compatible_model: string
    openai_compatible_api_key: string
  }
  embedding: {
    provider: string
    model: string
    dimension: number
  }
}

export default function Settings() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [config, setConfig] = useState<RuntimeConfig | null>(null)
  const { neo4j, provider } = useHealthStore()

  useEffect(() => {
    api.get<HealthStatus>('/health')
      .then(r => setHealth(r.data))
      .catch(() => {})
    ingestionApi.get<RuntimeConfig>('/config')
      .then(r => setConfig(r.data))
      .catch(() => {})
  }, [])

  const configRows = config ? [
    { label: 'OPENAI_COMPATIBLE_API_KEY', value: config.llm.openai_compatible_api_key },
    { label: 'OPENAI_COMPATIBLE_BASE_URL', value: config.llm.openai_compatible_base_url },
    { label: 'OPENAI_COMPATIBLE_MODEL', value: config.llm.openai_compatible_model },
    { label: 'EMBEDDING_PROVIDER', value: config.embedding.provider },
    { label: 'EMBEDDING_MODEL', value: config.embedding.model },
  ] : []

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
          <div className="space-y-3">
            {configRows.map(({ label, value }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-graph-500 mb-1">{label}</label>
                <div className="w-full px-3 py-2 border border-graph-200 rounded-lg bg-graph-50 text-graph-700 text-sm font-mono break-all">
                  {value}
                </div>
              </div>
            ))}
            {!config && (
              <p className="text-sm text-graph-400 italic">Loading configuration…</p>
            )}
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
