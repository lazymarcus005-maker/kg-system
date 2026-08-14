import axios from 'axios'

// In dev: Vite proxy rewrites /ingest-api/* → http://localhost:8001/*
// In Docker prod: the web server proxies /ingest-api/* and attaches the API key
const baseURL = (import.meta.env.VITE_INGEST_BASE as string | undefined) ?? '/ingest-api'

const ingestionApi = axios.create({
  baseURL,
  timeout: 120000, // 2 min — PDF uploads can be slow
})

export default ingestionApi
