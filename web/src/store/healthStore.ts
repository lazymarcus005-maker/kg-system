import { create } from 'zustand'

export type ServiceStatus = 'unknown' | 'healthy' | 'error'

interface HealthState {
  queryApi: ServiceStatus
  ingestionApi: ServiceStatus
  mcpServer: ServiceStatus
  neo4j: boolean
  provider: string
  setQueryApi: (s: ServiceStatus) => void
  setIngestionApi: (s: ServiceStatus) => void
  setMcpServer: (s: ServiceStatus) => void
  setNeo4j: (ok: boolean) => void
  setProvider: (p: string) => void
}

export const useHealthStore = create<HealthState>((set) => ({
  queryApi: 'unknown',
  ingestionApi: 'unknown',
  mcpServer: 'unknown',
  neo4j: false,
  provider: '',
  setQueryApi: (s) => set({ queryApi: s }),
  setIngestionApi: (s) => set({ ingestionApi: s }),
  setMcpServer: (s) => set({ mcpServer: s }),
  setNeo4j: (ok) => set({ neo4j: ok }),
  setProvider: (p) => set({ provider: p }),
}))
