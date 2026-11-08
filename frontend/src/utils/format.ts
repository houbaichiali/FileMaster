export function formatBytes(bytes: number, locale?: string): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: i === 0 ? 0 : value < 10 ? 2 : 1 })
  return `${nf.format(value)} ${units[i]}`
}

/** 83.5 -> "1:23.500" ; 5 -> "0:05.000" ; 3725 -> "1:02:05.000" */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const totalMs = Math.round(seconds * 1000)
  const ms = totalMs % 1000
  const s = Math.floor(totalMs / 1000) % 60
  const m = Math.floor(totalMs / 60000) % 60
  const h = Math.floor(totalMs / 3600000)
  const tail = `${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${tail}` : `${m}:${tail}`
}

/** Accepts "83.5", "1:23.5", "1:02:05" (also with a comma as decimal separator). Returns null if invalid. */
export function parseTime(input: string): number | null {
  const raw = input.trim().replace(',', '.')
  if (!raw) return null
  const parts = raw.split(':')
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null
  return parts.reduce((acc, p) => acc * 60 + parseFloat(p), 0)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export const cx = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ')
