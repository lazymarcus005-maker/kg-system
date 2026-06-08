import { TrendingUp, Database, GitBranch, Activity } from 'lucide-react'
import { useState, useEffect } from 'react'
import StatCard from '../components/StatCard'
import api from '../lib/api'
import ingestionApi from '../lib/ingestionApi'
import { useHealthStore } from '../store/healthStore'
import { useJobsStore } from '../store/jobsStore'
import type { GraphStats, JobsDict } from '../lib/types'

export default function Dashboard() {
  const [stats, setStats] = useState<GraphStats | null>(null)
  const { queryApi, ingestionApi: ingestionStatus, mcpServer, neo4j, provider } = useHealthStore()
  const { jobs, setJobs, setLastFetched } = useJobsStore()

  useEffect(() => {
    // Fetch graph stats
    api.get<GraphStats>('/graph/stats')
      .then((r) => setStats(r.data))
      .catch(() => {/* silent */})

    // Fetch jobs for recent activity
    ingestionApi.get<JobsDict>('/jobs')
      .then((r) => {
        setJobs(r.data)
        setLastFetched(Date.now())
      })
      .catch(() => {/* silent */})
  }, [setJobs, setLastFetched])

  const activeJobs = Object.values(jobs).filter(
    (j) => j.status === 'queued' || j.status === 'processing'
  ).length

  const recentJobs = Object.entries(jobs)
    .reverse()
    .slice(0, 5)

  const services = [
    { name: 'Query API', status: queryApi },
    { name: 'Ingestion API', status: ingestionStatus },
    { name: 'MCP Server', status: mcpServer },
    { name: 'Neo4j Graph DB', status: neo4j ? 'healthy' : (queryApi === 'healthy' ? 'error' : 'unknown') },
  ] as const

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graph-900 mb-2">Dashboard</h1>
        <p className="text-graph-600">System overview and key metrics</p>
        {provider && (
          <p className="text-sm text-graph-500 mt-1">LLM Provider: <span className="font-semibold text-graph-700">{provider}</span></p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Knowledge Nodes"
          value={stats ? stats.nodes.toLocaleString() : '—'}
          change=""
          icon={<Database size={24} />}
          color="green"
        />
        <StatCard
          title="Relations"
          value={stats ? stats.relations.toLocaleString() : '—'}
          change=""
          icon={<GitBranch size={24} />}
          color="purple"
        />
        <StatCard
          title="Documents"
          value={stats ? stats.documents.toLocaleString() : '—'}
          change=""
          icon={<TrendingUp size={24} />}
          color="blue"
        />
        <StatCard
          title="Active Jobs"
          value={activeJobs.toString()}
          change={activeJobs > 0 ? 'processing' : 'idle'}
          icon={<Activity size={24} />}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Jobs */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-graph-900 mb-4">Recent Ingestions</h3>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-graph-500 py-4 text-center">No ingestion jobs yet</p>
          ) : (
            <div className="space-y-3">
              {recentJobs.map(([jobId, job]) => (
                <div key={jobId} className="flex items-center justify-between p-3 bg-graph-50 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-graph-900 text-sm truncate">{job.filename}</p>
                    <p className="text-xs text-graph-500 mt-0.5 capitalize">{job.status}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ml-2 flex-shrink-0 ${
                    job.status === 'done'
                      ? 'bg-green-100 text-green-700'
                      : job.status === 'error'
                      ? 'bg-red-100 text-red-700'
                      : job.status === 'processing'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Health */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-graph-900 mb-4">System Health</h3>
          <div className="space-y-4">
            {services.map((svc) => (
              <div key={svc.name} className="flex items-center justify-between">
                <span className="text-graph-700 text-sm">{svc.name}</span>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      svc.status === 'healthy'
                        ? 'bg-green-500'
                        : svc.status === 'error'
                        ? 'bg-red-500'
                        : 'bg-gray-300'
                    }`}
                  />
                  <span className={`text-sm font-medium capitalize ${
                    svc.status === 'healthy'
                      ? 'text-green-600'
                      : svc.status === 'error'
                      ? 'text-red-600'
                      : 'text-graph-400'
                  }`}>
                    {svc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
