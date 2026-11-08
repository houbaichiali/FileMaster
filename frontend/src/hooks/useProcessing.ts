import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, Endpoint, JobResult, pollJob, startJob } from '../services/api'
import { addRecent, RecentEntry } from './useRecent'
import { useToast } from './useToast'

export type ProcessingState =
  | { phase: 'idle' }
  | { phase: 'running'; progress: number }
  | { phase: 'done'; jobId: string; result: JobResult }
  | { phase: 'error'; error: ApiError }

export function useProcessing(tool: RecentEntry['tool']) {
  const [state, setState] = useState<ProcessingState>({ phase: 'idle' })
  const abort = useRef<AbortController | null>(null)
  const { notify } = useToast()
  const { t } = useTranslation()

  useEffect(() => () => abort.current?.abort(), [])

  const run = useCallback(
    async (endpoint: Endpoint, body: Record<string, unknown>) => {
      abort.current?.abort()
      const ctrl = new AbortController()
      abort.current = ctrl
      setState({ phase: 'running', progress: 0 })
      try {
        const id = await startJob(endpoint, body)
        const job = await pollJob(id, (j) => setState({ phase: 'running', progress: j.progress }), ctrl.signal)
        if (job.state === 'done' && job.result) {
          setState({ phase: 'done', jobId: id, result: job.result })
          addRecent({
            jobId: id,
            filename: job.result.filename,
            originalName: job.result.original_name,
            format: job.result.format,
            size: job.result.size,
            originalSize: job.result.original_size,
            tool,
            date: Date.now(),
          })
          notify(t('toast.done'))
        } else {
          throw new ApiError(job.error?.code ?? 'internal', job.error?.params ?? {})
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setState({ phase: 'error', error: e instanceof ApiError ? e : new ApiError('internal') })
      }
    },
    [notify, t, tool],
  )

  const reset = useCallback(() => {
    abort.current?.abort()
    setState({ phase: 'idle' })
  }, [])

  return { state, run, reset }
}
