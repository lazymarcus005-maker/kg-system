// ── Health ─────────────────────────────────────────────────────────────
export interface HealthStatus {
  status: 'ok' | 'error'
  neo4j?: boolean
  provider?: string
  tools?: number
}

// ── Jobs ───────────────────────────────────────────────────────────────
export type JobStatus = 'queued' | 'processing' | 'done' | 'error'
export interface Job {
  status: JobStatus
  filename: string
  result?: Record<string, unknown>
  error?: string
}
export type JobsDict = Record<string, Job>

// ── Graph Stats ────────────────────────────────────────────────────────
export interface GraphStats {
  nodes: number
  relations: number
  documents: number
}

// ── Chat ───────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}
export interface KgSource {
  type: string
  query?: string
  data?: unknown[]
  fallback?: boolean
}
export interface ChatResponse {
  id: string
  choices: Array<{
    message: ChatMessage
    finish_reason: string
  }>
  kg_sources?: KgSource[]
}
export interface ChatCompletionMessage {
  role: 'user' | 'assistant'
  content: string
  kg_sources?: KgSource[]
}

// ── Entities ───────────────────────────────────────────────────────────
export interface Entity {
  id: string
  labels: string[]
  name: string
  description?: string
  status: 'verified' | 'unverified'
}
export interface EntitiesResponse {
  total: number
  items: Entity[]
}

// ── Relations ──────────────────────────────────────────────────────────
export interface Relation {
  id: string
  relation_type: string
  source_name: string
  source_id: string
  target_name: string
  target_id: string
  confidence?: number
  evidence?: string
  status: 'pending' | 'approved' | 'rejected'
}
export interface RelationCounts {
  pending: number
  approved: number
  rejected: number
}
export interface RelationsResponse {
  items: Relation[]
  counts: RelationCounts
}

// ── Ontology ───────────────────────────────────────────────────────────
export interface OntologyType {
  name: string
  count: number
}
export interface OntologyResponse {
  node_types: OntologyType[]
  relation_types: OntologyType[]
}

// ── Graph Nodes ────────────────────────────────────────────────────────
export interface GraphNode {
  id: string
  name: string
  labels: string[]
  description?: string
}
export interface GraphNodesResponse {
  results: GraphNode[]
}

// ── Graph Neighborhood ─────────────────────────────────────────────────
export interface GraphNeighborhood {
  node_type: string
  node_id: string
  depth: number
  results: unknown[]
  error?: string
}

// ── MCP ────────────────────────────────────────────────────────────────
export interface McpTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}
export interface McpToolsResponse {
  tools: McpTool[]
}

// ── Cypher Debug ───────────────────────────────────────────────────────
export interface CypherResponse {
  cypher: string
  results: unknown[]
}

// ── Models ─────────────────────────────────────────────────────────────
export interface ModelInfo {
  id: string
  object: string
  owned_by: string
}
export interface ModelsResponse {
  object: string
  data: ModelInfo[]
}
