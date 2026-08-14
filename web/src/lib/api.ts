import axios from 'axios'

// Requests go through the web server's reverse proxy, which attaches the API key
const baseURL = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

export default api
