import { AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatTime, parseTime } from '../utils/format'

export function TimeInput({ id, value, max, onChange }: { id: string; value: number; max: number; onChange: (s: number) => void }) {
  const [draft, setDraft] = useState(formatTime(value))
  const [invalid, setInvalid] = useState(false)
  useEffect(() => { setDraft(formatTime(value)); setInvalid(false) }, [value])
  const commit = () => {
    const parsed = parseTime(draft)
    if (parsed === null || parsed > max + 0.001) { setInvalid(true); return }
    setInvalid(false)
    onChange(parsed)
  }
  return (
    <div className="relative">
      <input
        id={id}
        className={`field tabular-nums ${invalid ? 'border-ink ring-1 ring-ink' : ''}`}
        inputMode="decimal"
        value={draft}
        aria-invalid={invalid}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
      {invalid && <AlertCircle size={16} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2" aria-hidden />}
    </div>
  )
}
