import { Upload, RefreshCw } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import ingestionApi from '../lib/ingestionApi'
import { useJobsStore } from '../store/jobsStore'
import { logEvent } from '../lib/auditLog'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import type { JobsDict, JobStatus } from '../lib/types'

const STATUS_COLORS: Record<JobStatus, string> = {
  queued: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}

export default function DocumentsIngestion() {
  const { jobs, setJobs, setLastFetched } = useJobsStore()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [loadingJobs, setLoadingJobs] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await ingestionApi.get<JobsDict>('/jobs')
      setJobs(res.data)
      setLastFetched(Date.now())
    } catch {
      // silent — don't overwrite previous data on transient errors
    } finally {
      setLoadingJobs(false)
    }
  }, [setJobs, setLastFetched])

  // Initial load
  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Poll while any job is active
  useEffect(() => {
    const hasActive = Object.values(jobs).some(
      (j) => j.status === 'queued' || j.status === 'processing'
    )
    if (hasActive && !pollingRef.current) {
      pollingRef.current = setInterval(fetchJobs, 3000)
    } else if (!hasActive && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [jobs, fetchJobs])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.pdf')) {
      setError('Only PDF files are supported')
      return
    }
    setError('')
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      await ingestionApi.post('/ingest', formData)
      await fetchJobs()
      // Reset input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg)
    } finally {
      setUploading(false)
    }
  }

  // Audit on job completion
  useEffect(() => {
    Object.entries(jobs).forEach(([, job]) => {
      if (job.status === 'done') {
        logEvent({
          type: 'ingest',
          action: 'INGESTED',
          entity: `Document: ${job.filename}`,
          details: job.result
            ? `${JSON.stringify(job.result).substring(0, 80)}`
            : 'Completed',
        })
      }
    })
    // We don't track which ones we've already logged here — simple implementation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const jobEntries = Object.entries(jobs).reverse()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graph-900 mb-2">Documents / Ingestion</h1>
        <p className="text-graph-600">Upload, manage, and monitor document ingestion</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-graph-900 mb-4">Upload Document</h3>

            {error && (
              <ErrorBanner message={error} onDismiss={() => setError('')} />
            )}

            <label className="block">
              <div className="border-2 border-dashed border-graph-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-2" />
                    <p className="text-sm text-graph-600">Uploading…</p>
                  </div>
                ) : (
                  <>
                    <Upload size={32} className="mx-auto text-graph-400 mb-2" />
                    <p className="text-sm text-graph-600">Drop PDF files here or click to browse</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>

            <div className="mt-4 space-y-1 text-sm text-graph-500">
              <p>• Supported: PDF files</p>
              <p>• Auto-extracts chunks, entities, relations</p>
            </div>
          </div>
        </div>

        {/* Jobs table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-graph-900">Ingestion Jobs</h3>
              <button
                onClick={() => fetchJobs()}
                className="p-2 hover:bg-graph-100 rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw size={16} className="text-graph-600" />
              </button>
            </div>

            {loadingJobs ? (
              <LoadingSpinner message="Loading jobs…" />
            ) : jobEntries.length === 0 ? (
              <div className="text-center py-12 text-graph-500">
                <p className="text-sm">No jobs yet. Upload a PDF to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-graph-200">
                      <th className="text-left text-sm font-semibold text-graph-700 py-3 px-4">File Name</th>
                      <th className="text-left text-sm font-semibold text-graph-700 py-3 px-4">Status</th>
                      <th className="text-left text-sm font-semibold text-graph-700 py-3 px-4">Job ID</th>
                      <th className="text-left text-sm font-semibold text-graph-700 py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobEntries.map(([jobId, job]) => (
                      <tr key={jobId} className="border-b border-graph-100 hover:bg-graph-50">
                        <td className="py-3 px-4 text-sm text-graph-900 font-medium">
                          {job.filename}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_COLORS[job.status]}`}>
                            {job.status}
                            {job.status === 'processing' && (
                              <span className="ml-1 inline-block w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-graph-500 font-mono">{jobId}</td>
                        <td className="py-3 px-4 text-sm text-graph-600">
                          {job.error ? (
                            <span className="text-red-600">{job.error}</span>
                          ) : job.result ? (
                            <span className="text-green-700">
                              {typeof job.result === 'object'
                                ? Object.entries(job.result)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(' | ')
                                : String(job.result)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
