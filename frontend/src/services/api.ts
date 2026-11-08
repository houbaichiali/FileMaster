export type Kind = 'image' | 'document' | 'audio' | 'video'

export interface FileMeta {
  id: string
  original_name: string
  format: string
  kind: Kind
  size: number
  info: { width?: number; height?: number; duration?: number; has_video?: boolean; has_audio?: boolean; pages?: number }
  targets: string[]
  previewable: boolean
}

export interface JobResult {
  filename: string
  original_name: string
  format: string
  mime: string
  size: number
  original_size: number
  saved_bytes: number
  saved_percent: number
  previewable: boolean
  details: Record<string, unknown>
}

export interface Job {
  id: string
  kind: string
  state: 'queued' | 'running' | 'done' | 'error'
  progress: number
  error: { code: string; params: Record<string, unknown> } | null
  result: JobResult | null
}

export interface FormatsInfo {
  conversions: Record<string, string[]>
  max_upload_mb: number
  ttl_minutes: number
  levels: string[]
}

export class ApiError extends Error {
  code: string
  params: Record<string, unknown>
  status: number
  constructor(code: string, params: Record<string, unknown> = {}, status = 0) {
    super(code)
    this.code = code
    this.params = params
    this.status = status
  }
}

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json()
    return new ApiError(body?.error?.code ?? 'internal', body?.error?.params ?? {}, res.status)
  } catch {
    return new ApiError('internal', {}, res.status)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, init)
  } catch {
    throw new ApiError('network')
  }
  if (!res.ok) throw await toError(res)
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

export function uploadFile(file: File, onProgress?: (ratio: number) => void): Promise<FileMeta> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}/upload`)
    xhr.responseType = 'json'
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onerror = () => reject(new ApiError('network'))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.response as FileMeta)
      const body = xhr.response as { error?: { code?: string; params?: Record<string, unknown> } } | null
      reject(new ApiError(body?.error?.code ?? 'internal', body?.error?.params ?? {}, xhr.status))
    }
    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

export type Endpoint = 'convert' | 'compress' | 'image/edit' | 'trim'

export async function startJob(endpoint: Endpoint, body: Record<string, unknown>): Promise<string> {
  const data = await request<{ job_id: string }>(`/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return data.job_id
}

export const getJob = (id: string) => request<Job>(`/jobs/${id}`)
export const getFormats = () => request<FormatsInfo>('/formats')
export const getHealth = () => request<{ status: string; ffmpeg: boolean; ffprobe: boolean }>('/health')
export const deleteFile = (id: string) => request<void>(`/files/${id}`, { method: 'DELETE' })

export const sourcePreviewUrl = (fileId: string) => `${BASE}/files/${fileId}/preview`
export const jobPreviewUrl = (jobId: string) => `${BASE}/jobs/${jobId}/preview`
export const jobDownloadUrl = (jobId: string) => `${BASE}/jobs/${jobId}/download`

export async function isJobAvailable(jobId: string): Promise<boolean> {
  try {
    const job = await getJob(jobId)
    return job.state === 'done'
  } catch {
    return false
  }
}

export async function pollJob(id: string, onUpdate: (job: Job) => void, signal?: AbortSignal): Promise<Job> {
  for (;;) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
    const job = await getJob(id)
    onUpdate(job)
    if (job.state === 'done' || job.state === 'error') return job
    await new Promise((r) => setTimeout(r, 500))
  }
}
