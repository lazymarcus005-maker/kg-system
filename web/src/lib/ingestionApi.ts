import axios from 'axios'

// In dev: Vite proxy rewrites /ingest-api/* → http://localhost:8001/*
// In Docker prod: VITE_INGEST_BASE is injected at build time
const baseURL = (import.meta.env.VITE_INGEST_BASE as string | undefined) ?? '/ingest-api'

const ingestionApi = axios.create({
  baseURL,
  timeout: 120000, // 2 min — PDF uploads can be slow
})

export default ingestionApi
