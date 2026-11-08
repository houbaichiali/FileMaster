import { createStore, useStore } from '../utils/store'

export interface RecentEntry {
  jobId: string
  filename: string
  originalName: string
  format: string
  size: number
  originalSize: number
  tool: 'convert' | 'compress' | 'image-edit' | 'trim'
  date: number
}

const MAX = 30
const store = createStore<RecentEntry[]>('fm-recent', [], (raw) => (Array.isArray(raw) ? (raw as RecentEntry[]).slice(0, MAX) : []))

export function addRecent(entry: RecentEntry) {
  store.set([entry, ...store.get().filter((e) => e.jobId !== entry.jobId)].slice(0, MAX))
}

export const clearRecent = () => store.set([])

export function useRecent() {
  const entries = useStore(store)
  return {
    entries,
    remove: (jobId: string) => store.set(store.get().filter((e) => e.jobId !== jobId)),
    clear: clearRecent,
  }
}
