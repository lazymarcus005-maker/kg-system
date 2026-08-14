import axios from 'axios'

// In dev: Vite proxy rewrites /mcp/* → http://localhost:8002/*
// In Docker prod: the web server proxies /mcp/* and attaches the API key
const baseURL = (import.meta.env.VITE_MCP_BASE as string | undefined) ?? '/mcp'

const mcpApi = axios.create({
  baseURL,
  timeout: 10000,
})

export default mcpApi
