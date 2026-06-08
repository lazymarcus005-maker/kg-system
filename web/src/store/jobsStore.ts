import { create } from 'zustand'
import type { JobsDict } from '../lib/types'

interface JobsState {
  jobs: JobsDict
  lastFetched: number
  setJobs: (jobs: JobsDict) => void
  setLastFetched: (t: number) => void
}

export const useJobsStore = create<JobsState>((set) => ({
  jobs: {},
  lastFetched: 0,
  setJobs: (jobs) => set({ jobs }),
  setLastFetched: (t) => set({ lastFetched: t }),
}))
