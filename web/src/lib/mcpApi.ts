import axios from 'axios'

// In dev: Vite proxy rewrites /mcp-api/* → http://localhost:8002/*
// In Docker prod: VITE_MCP_BASE is injected at build time
const baseURL = (import.meta.env.VITE_MCP_BASE as string | undefined) ?? '/mcp-api'

const mcpApi = axios.create({
  baseURL,
  timeout: 10000,
})

export default mcpApi
