import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import api from '../lib/api'
import ingestionApi from '../lib/ingestionApi'
import mcpApi from '../lib/mcpApi'
import { useHealthStore } from '../store/healthStore'
import type { HealthStatus } from '../lib/types'

export default function Layout() {
  const {
    setQueryApi, setIngestionApi, setMcpServer, setNeo4j, setProvider,
  } = useHealthStore()

  useEffect(() => {
    const checkHealth = async () => {
      // Query API
      try {
        const res = await api.get<HealthStatus>('/health')
        setQueryApi('healthy')
        setNeo4j(res.data.neo4j ?? false)
        setProvider(res.data.provider ?? '')
      } catch {
        setQueryApi('error')
      }

      // Ingestion API
      try {
        await ingestionApi.get('/health')
        setIngestionApi('healthy')
      } catch {
        setIngestionApi('error')
      }

      // MCP Server
      try {
        await mcpApi.get('/health')
        setMcpServer('healthy')
      } catch {
        setMcpServer('error')
      }
    }

    checkHealth()
  }, [setQueryApi, setIngestionApi, setMcpServer, setNeo4j, setProvider])

  return (
    <div className="flex h-screen bg-graph-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
