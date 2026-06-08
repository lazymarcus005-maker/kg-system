import axios from 'axios'

// In dev: Vite proxy rewrites /api/* → http://localhost:8000/*
// In Docker prod: VITE_API_BASE is injected at build time
const baseURL = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'
const apiKey = (import.meta.env.VITE_API_KEY as string | undefined) ?? 'changeme'

const api = axios.create({
  baseURL,
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

export default api
