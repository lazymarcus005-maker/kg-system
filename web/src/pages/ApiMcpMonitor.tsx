import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'
import ingestionApi from '../lib/ingestionApi'
import mcpApi from '../lib/mcpApi'
import { useHealthStore } from '../store/healthStore'
import type { McpTool, HealthStatus } from '../lib/types'

interface ServiceInfo {
  label: string
  endpoint: string
  status: 'unknown' | 'healthy' | 'error'
  detail?: string
  latencyMs?: number
}

interface ErrorEntry {
  time: string
  service: string
  message: string
  type: 'error' | 'warning'
}

export default function ApiMcpMonitor() {
  const { setQueryApi, setIngestionApi, setMcpServer, setNeo4j, setProvider } = useHealthStore()
  const [services, setServices] = useState<ServiceInfo[]>([
    { label: 'Query API (GraphRAG)', endpoint: 'http://localhost:8000', status: 'unknown' },
    { label: 'Ingestion API', endpoint: 'http://localhost:8001', status: 'unknown' },
    { label: 'MCP Server', endpoint: 'http://localhost:8002', status: 'unknown' },
  ])
  const [mcpTools, setMcpTools] = useState<McpTool[]>([])
  const [errors, setErrors] = useState<ErrorEntry[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkAll = async () => {
    setRefreshing(true)
    const updated: ServiceInfo[] = []
    const newErrors: ErrorEntry[] = []

    // Query API
    const t0 = Date.now()
    try {
      const r = await api.get<HealthStatus>('/health')
      const latencyMs = Date.now() - t0
      updated.push({
        label: 'Query API (GraphRAG)',
        endpoint: 'http://localhost:8000',
        status: 'healthy',
        detail: `Neo4j: ${r.data.neo4j ? '✓' : '✗'} | Provider: ${r.data.provider ?? '?'}`,
        latencyMs,
      })
      setQueryApi('healthy')
      setNeo4j(r.data.neo4j ?? false)
      setProvider(r.data.provider ?? '')
    } catch (e: unknown) {
      updated.push({ label: 'Query API (GraphRAG)', endpoint: 'http://localhost:8000', status: 'error' })
      setQueryApi('error')
      newErrors.push({
        time: new Date().toISOString(),
        service: 'Query API',
        message: e instanceof Error ? e.message : 'Unreachable',
        type: 'error',
      })
    }

    // Ingestion API
    const t1 = Date.now()
    try {
      const r = await ingestionApi.get<HealthStatus>('/health')
      const latencyMs = Date.now() - t1
      updated.push({
        label: 'Ingestion API',
        endpoint: 'http://localhost:8001',
        status: 'healthy',
        detail: `Provider: ${r.data.provider ?? '?'}`,
        latencyMs,
      })
      setIngestionApi('healthy')
    } catch (e: unknown) {
      updated.push({ label: 'Ingestion API', endpoint: 'http://localhost:8001', status: 'error' })
      setIngestionApi('error')
      newErrors.push({
        time: new Date().toISOString(),
        service: 'Ingestion API',
        message: e instanceof Error ? e.message : 'Unreachable',
        type: 'error',
      })
    }

    // MCP Server
    const t2 = Date.now()
    try {
      const r = await mcpApi.get<HealthStatus & { tools?: number }>('/health')
      const latencyMs = Date.now() - t2
      updated.push({
        label: 'MCP Server',
        endpoint: 'http://localhost:8002',
        status: 'healthy',
        detail: `Tools: ${r.data.tools ?? '?'}`,
        latencyMs,
      })
      setMcpServer('healthy')
    } catch (e: unknown) {
      updated.push({ label: 'MCP Server', endpoint: 'http://localhost:8002', status: 'error' })
      setMcpServer('error')
      newErrors.push({
        time: new Date().toISOString(),
        service: 'MCP Server',
        message: e instanceof Error ? e.message : 'Unreachable',
        type: 'error',
      })
    }

    setServices(updated)
    if (newErrors.length > 0) {
      setErrors((prev) => [...newErrors, ...prev].slice(0, 20))
    }
    setRefreshing(false)
  }

  const loadMcpTools = async () => {
    try {
      const r = await mcpApi.get<{ tools: McpTool[] }>('/tools/list')
      setMcpTools(r.data.tools ?? [])
    } catch {
      setMcpTools([])
    }
  }

  useEffect(() => {
    checkAll()
    loadMcpTools()
    timerRef.current = setInterval(checkAll, 30000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const StatusIcon = ({ status }: { status: ServiceInfo['status'] }) => {
    if (status === 'healthy') return <CheckCircle size={20} className="text-green-600" />
    if (status === 'error') return <XCircle size={20} className="text-red-600" />
    return <AlertCircle size={20} className="text-gray-400 animate-pulse" />
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-graph-900 mb-2">API / MCP Monitor</h1>
          <p className="text-graph-600">Monitor API endpoints and MCP tool availability</p>
        </div>
        <button
          onClick={checkAll}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 border border-graph-300 rounded-lg text-sm font-medium hover:bg-graph-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Services grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {services.map((svc) => (
          <div key={svc.label} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-graph-900">{svc.label}</h3>
              <StatusIcon status={svc.status} />
            </div>
            <p className="text-xs font-mono text-graph-500 mb-3 truncate">{svc.endpoint}</p>
            {svc.status === 'healthy' && (
              <div className="space-y-1">
                {svc.detail && (
                  <p className="text-sm text-graph-700">{svc.detail}</p>
                )}
                {svc.latencyMs !== undefined && (
                  <p className="text-sm text-graph-500">
                    Latency: <span className="font-semibold text-graph-900">{svc.latencyMs}ms</span>
                  </p>
                )}
              </div>
            )}
            {svc.status === 'error' && (
              <p className="text-sm text-red-600">Service unreachable</p>
            )}
            {svc.status === 'unknown' && (
              <p className="text-sm text-graph-400">Checking…</p>
            )}
          </div>
        ))}
      </div>

      {/* MCP Tools */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold text-graph-900 mb-4">
          Available MCP Tools
          <span className="ml-2 text-sm font-normal text-graph-500">({mcpTools.length})</span>
        </h3>
        {mcpTools.length === 0 ? (
          <p className="text-sm text-graph-500">No tools loaded — MCP server may be offline</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mcpTools.map((tool) => (
              <div
                key={tool.name}
                className="border border-graph-200 rounded-lg p-4 flex items-start justify-between"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-graph-900">{tool.name}</p>
                  {tool.description && (
                    <p className="text-xs text-graph-500 mt-1 line-clamp-2">{tool.description}</p>
                  )}
                </div>
                <CheckCircle size={18} className="text-green-600 ml-2 flex-shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Log */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-graph-900 mb-4">Recent Errors</h3>
        {errors.length === 0 ? (
          <p className="text-sm text-green-600">✓ No errors recorded this session</p>
        ) : (
          <div className="space-y-3">
            {errors.map((entry, idx) => (
              <div
                key={idx}
                className="p-4 rounded-lg flex items-start space-x-3 bg-red-50 border border-red-200"
              >
                <AlertCircle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-900">{entry.service}: {entry.message}</p>
                  <p className="text-xs text-red-600 mt-1 font-mono">
                    {new Date(entry.time).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
