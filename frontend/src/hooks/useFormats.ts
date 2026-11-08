import { useEffect, useState } from 'react'
import { FormatsInfo, getFormats } from '../services/api'

const FALLBACK: FormatsInfo = { conversions: {}, max_upload_mb: 200, ttl_minutes: 60, levels: [] }
let cached: FormatsInfo | null = null
let pending: Promise<FormatsInfo> | null = null

export function useFormats(): FormatsInfo {
  const [info, setInfo] = useState<FormatsInfo>(cached ?? FALLBACK)
  useEffect(() => {
    if (cached) return
    pending ??= getFormats().then((f) => (cached = f))
    let alive = true
    pending.then((f) => alive && setInfo(f)).catch(() => (pending = null))
    return () => {
      alive = false
    }
  }, [])
  return info
}
