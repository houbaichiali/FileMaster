import { KeyboardEvent, PointerEvent, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { clamp, formatTime } from '../utils/format'

interface Props {
  duration: number
  start: number
  end: number
  current: number
  zoom: number
  onRange: (start: number, end: number) => void
  onSeek: (t: number) => void
}

const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800]
type Drag = 'start' | 'end' | 'head' | null

/** Interactive trimming timeline: draggable start/end handles, playhead and zoom. Always LTR (time flows left to right). */
export function Timeline({ duration, start, end, current, zoom, onRange, onSeek }: Props) {
  const { t } = useTranslation()
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag>(null)
  const pct = (s: number) => `${(s / duration) * 100}%`
  const step = STEPS.find((s) => duration / s <= 10 * zoom) ?? 3600
  const ticks = Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => i * step)

  const timeAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect()
    return clamp((clientX - r.left) / r.width, 0, 1) * duration
  }
  const move = (e: PointerEvent) => {
    if (!drag.current) return
    const tm = timeAt(e.clientX)
    if (drag.current === 'start') onRange(clamp(tm, 0, end - 0.05), end)
    else if (drag.current === 'end') onRange(start, clamp(tm, start + 0.05, duration))
    else onSeek(tm)
  }
  const begin = (kind: Drag) => (e: PointerEvent) => {
    e.stopPropagation()
    drag.current = kind
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    if (kind === 'head') onSeek(timeAt(e.clientX))
  }
  const finish = () => { drag.current = null }
  const key = (kind: 'start' | 'end') => (e: KeyboardEvent) => {
    const d = (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0) * (e.shiftKey ? 1 : 0.1)
    if (!d) return
    e.preventDefault()
    if (kind === 'start') onRange(clamp(start + d, 0, end - 0.05), end)
    else onRange(start, clamp(end + d, start + 0.05, duration))
  }

  return (
    <div dir="ltr" className="overflow-x-auto rounded-2xl border border-line" data-testid="timeline">
      <div className="relative select-none px-3 pb-3 pt-2" style={{ width: `${zoom * 100}%`, minWidth: '100%' }}>
        <div className="relative mb-1 h-5 text-[11px] text-fg-2" aria-hidden>
          {ticks.map((tk) => <span key={tk} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pct(tk) }}>{formatTime(tk).replace(/\.000$/, '')}</span>)}
        </div>
        <div ref={track} className="relative h-16 touch-none rounded-xl bg-track" onPointerDown={begin('head')} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
          <div className="pointer-events-none absolute inset-y-0 rounded-xl bg-ink/25" style={{ left: pct(start), width: `${((end - start) / duration) * 100}%` }} />
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-ink" style={{ left: pct(current) }} aria-hidden>
            <span className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-ink" />
          </div>
          {(['start', 'end'] as const).map((k) => (
            <div
              key={k}
              role="slider"
              tabIndex={0}
              aria-label={t(k === 'start' ? 'editor.handleStart' : 'editor.handleEnd')}
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={k === 'start' ? start : end}
              aria-valuetext={formatTime(k === 'start' ? start : end)}
              onPointerDown={begin(k)}
              onPointerMove={move}
              onPointerUp={finish}
              onKeyDown={key(k)}
              className="absolute inset-y-[-4px] flex w-4 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full bg-ink shadow-glass"
              style={{ left: pct(k === 'start' ? start : end) }}
            >
              <span className="h-5 w-0.5 rounded bg-ink-contrast" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
