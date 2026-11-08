import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin, { Region } from 'wavesurfer.js/plugins/regions'
import { FloatingActionButton } from '../components/FloatingActionButton'
import { useTheme } from '../hooks/useTheme'
import { clamp, formatTime } from '../utils/format'

interface Props {
  url: string
  start: number
  end: number
  onRegion: (start: number, end: number) => void
}

export function WaveformEditor({ url, start, end, onRegion }: Props) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const box = useRef<HTMLDivElement>(null)
  const ws = useRef<WaveSurfer | null>(null)
  const region = useRef<Region | null>(null)
  const cb = useRef(onRegion)
  cb.current = onRegion
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [zoom, setZoom] = useState(0)
  const initial = useRef({ start, end })

  const colors = () => (theme === 'dark' ? { wave: '#6b6b6b', progress: '#f5f5f5' } : { wave: '#a8a8a8', progress: '#222222' })

  useEffect(() => {
    if (!box.current) return
    const regions = RegionsPlugin.create()
    const c = colors()
    const instance = WaveSurfer.create({ container: box.current, url, height: 120, waveColor: c.wave, progressColor: c.progress, cursorColor: c.progress, barWidth: 2, barGap: 1, barRadius: 2, normalize: true, plugins: [regions] })
    ws.current = instance
    instance.on('ready', () => {
      region.current = regions.addRegion({ start: initial.current.start, end: initial.current.end, drag: true, resize: true, color: 'rgba(128,128,128,0.32)' })
      setState('ready')
    })
    instance.on('error', () => setState('failed'))
    instance.on('timeupdate', (tm) => setTime(tm))
    instance.on('play', () => setPlaying(true))
    instance.on('pause', () => setPlaying(false))
    regions.on('region-updated', (r) => cb.current(r.start, r.end))
    return () => { instance.destroy(); ws.current = null; region.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  useEffect(() => {
    const c = colors()
    ws.current?.setOptions({ waveColor: c.wave, progressColor: c.progress, cursorColor: c.progress })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  useEffect(() => {
    const r = region.current
    if (r && (Math.abs(r.start - start) > 0.001 || Math.abs(r.end - end) > 0.001)) r.setOptions({ start, end })
  }, [start, end])

  const dur = () => ws.current?.getDuration() ?? 0
  const seek = (s: number) => ws.current?.setTime(clamp(s, 0, dur()))

  if (state === 'failed') return <p role="alert" className="rounded-2xl border border-ink px-4 py-3 text-sm">{t('editor.waveformFailed')}</p>

  return (
    <div className="flex flex-col gap-4" data-testid="waveform-editor">
      {state === 'loading' && <p className="text-sm text-fg-2" role="status">{t('editor.waveformLoading')}</p>}
      <div dir="ltr" ref={box} className="rounded-2xl border border-line p-2" aria-label={t('editor.timeline')} />
      <p className="hint">{t('editor.dragHint')}</p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FloatingActionButton label={t('editor.back')} icon={<SkipBack size={18} className="rtl:rotate-180" aria-hidden />} onClick={() => seek(time - 5)} />
          <FloatingActionButton size="lg" primary label={playing ? t('editor.pause') : t('editor.play')} icon={playing ? <Pause size={24} aria-hidden /> : <Play size={24} aria-hidden />} onClick={() => void ws.current?.playPause()} />
          <FloatingActionButton label={t('editor.forward')} icon={<SkipForward size={18} className="rtl:rotate-180" aria-hidden />} onClick={() => seek(time + 5)} />
          <FloatingActionButton label={t('editor.playSelection')} icon={<span className="text-xs font-semibold">A-B</span>} onClick={() => void region.current?.play()} />
        </div>
        <div className="flex items-center gap-4 text-sm tabular-nums" dir="ltr">
          <span>{t('editor.current')}: {formatTime(time)}</span>
          <span className="text-fg-2">{t('editor.total')}: {formatTime(dur())}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="glass rounded-full px-4 py-2 text-sm" onClick={() => onRegion(clamp(time, 0, end - 0.05), end)}>{t('editor.setStart')}</button>
        <button type="button" className="glass rounded-full px-4 py-2 text-sm" onClick={() => onRegion(start, clamp(time, start + 0.05, dur()))}>{t('editor.setEnd')}</button>
        <label className="ms-auto flex items-center gap-3 text-sm">
          {t('editor.zoom')}
          <input type="range" min={0} max={200} value={zoom} className="w-40" onChange={(e) => { const v = Number(e.target.value); setZoom(v); ws.current?.zoom(v) }} />
        </label>
      </div>
    </div>
  )
}
