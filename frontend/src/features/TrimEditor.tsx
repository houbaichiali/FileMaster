import { Pause, Play, Scissors, SkipBack, SkipForward } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorNotice } from '../components/ErrorNotice'
import { Field } from '../components/Field'
import { FileChip } from '../components/FileChip'
import { FileUploadZone } from '../components/FileUploadZone'
import { FloatingActionButton } from '../components/FloatingActionButton'
import { GlassButton } from '../components/GlassButton'
import { GlassCard } from '../components/GlassCard'
import { ProcessingIndicator } from '../components/ProcessingIndicator'
import { ResultCard } from '../components/ResultCard'
import { Segmented } from '../components/Segmented'
import { TimeInput } from '../components/TimeInput'
import { ToolHeader } from '../components/ToolHeader'
import { useProcessing } from '../hooks/useProcessing'
import { useSettings } from '../hooks/useSettings'
import { useToolFile } from '../hooks/useToolFile'
import { sourcePreviewUrl } from '../services/api'
import { clamp, formatTime } from '../utils/format'
import { FORMATS, upper } from '../utils/formats'
import { Timeline } from './Timeline'
import { WaveformEditor } from './WaveformEditor'

type Mode = 'simple' | 'advanced'

export function TrimEditor({ kind, icon }: { kind: 'audio' | 'video'; icon: React.ReactNode }) {
  const { t } = useTranslation()
  const { file, setFile } = useToolFile([kind])
  const { settings } = useSettings()
  const { state, run, reset } = useProcessing('trim')
  const media = useRef<HTMLMediaElement>(null)
  const stopAt = useRef<number | null>(null)
  const [mode, setMode] = useState<Mode>('simple')
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [precise, setPrecise] = useState(settings.preciseCut)
  const [outFormat, setOutFormat] = useState('')
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [playbackFailed, setPlaybackFailed] = useState(false)
  const duration = file?.info.duration ?? 0

  useEffect(() => {
    if (file) { setStart(0); setEnd(file.info.duration ?? 0); setOutFormat(file.format); setPlaybackFailed(false); setCurrent(0) }
  }, [file])

  const onRange = useCallback((s: number, e: number) => { setStart(s); setEnd(e) }, [])
  const valid = file !== null && start >= 0 && end > start && end <= duration + 0.01

  const toggle = () => { const m = media.current; if (!m) return; stopAt.current = null; if (m.paused) void m.play(); else m.pause() }
  const seek = (s: number) => { if (media.current) media.current.currentTime = clamp(s, 0, duration) }
  const playSelection = () => { const m = media.current; if (!m) return; m.currentTime = start; stopAt.current = end; void m.play() }
  const onTime = () => {
    const m = media.current
    if (!m) return
    setCurrent(m.currentTime)
    if (stopAt.current !== null && m.currentTime >= stopAt.current) { m.pause(); stopAt.current = null }
  }

  const submit = () => file && valid && void run('trim', { file_id: file.id, start, end, precise, output_format: outFormat !== file.format ? outFormat : undefined })

  if (!file) {
    return (
      <>
        <ToolHeader icon={icon} title={t(`nav.${kind}`)} description={t(`tools.${kind}`)} />
        <FileUploadZone accept={[kind]} onUploaded={setFile} />
      </>
    )
  }

  const player = kind === 'video'
    ? <video ref={media as React.RefObject<HTMLVideoElement>} src={sourcePreviewUrl(file.id)} controls={mode === 'simple'} playsInline preload="metadata" onTimeUpdate={onTime} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setPlaybackFailed(true)} className="max-h-[26rem] w-full rounded-2xl bg-black" />
    : mode === 'simple'
      ? <audio ref={media as React.RefObject<HTMLAudioElement>} src={sourcePreviewUrl(file.id)} controls onTimeUpdate={onTime} onError={() => setPlaybackFailed(true)} className="w-full" />
      : null

  return (
    <>
      <ToolHeader icon={icon} title={t(`nav.${kind}`)} description={t(`tools.${kind}`)} />
      <div className="flex flex-col gap-5">
        <FileChip file={file} onReplace={() => { setFile(null); reset() }} />

        {state.phase === 'running' && <ProcessingIndicator progress={state.progress} />}
        {state.phase === 'done' && <ResultCard jobId={state.jobId} result={state.result} onAnother={() => { reset(); setFile(null) }} />}
        {state.phase === 'error' && <ErrorNotice error={state.error} onRetry={reset} />}

        {(state.phase === 'idle' || state.phase === 'error') && (
          <>
            <Segmented ariaLabel={t('editor.mode')} value={mode} onChange={setMode} options={[{ value: 'simple', label: t('editor.simple') }, { value: 'advanced', label: t('editor.advanced') }]} className="max-w-xs" />

            <GlassCard className="flex flex-col gap-5">
              {player}
              {playbackFailed && <p className="hint" role="status">{t('editor.noPlayback')}</p>}

              {mode === 'advanced' && kind === 'audio' && <WaveformEditor url={sourcePreviewUrl(file.id)} start={start} end={end} onRegion={onRange} />}

              {mode === 'advanced' && kind === 'video' && (
                <div className="flex flex-col gap-4">
                  <Timeline duration={duration} start={start} end={end} current={current} zoom={zoom} onRange={onRange} onSeek={seek} />
                  <p className="hint">{t('editor.dragHint')}</p>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <FloatingActionButton label={t('editor.back')} icon={<SkipBack size={18} className="rtl:rotate-180" aria-hidden />} onClick={() => seek(current - 5)} />
                      <FloatingActionButton size="lg" primary label={playing ? t('editor.pause') : t('editor.play')} icon={playing ? <Pause size={24} aria-hidden /> : <Play size={24} aria-hidden />} onClick={toggle} />
                      <FloatingActionButton label={t('editor.forward')} icon={<SkipForward size={18} className="rtl:rotate-180" aria-hidden />} onClick={() => seek(current + 5)} />
                      <FloatingActionButton label={t('editor.playSelection')} icon={<span className="text-xs font-semibold">A-B</span>} onClick={playSelection} />
                    </div>
                    <div className="flex gap-4 text-sm tabular-nums" dir="ltr">
                      <span>{t('editor.current')}: {formatTime(current)}</span>
                      <span className="text-fg-2">{t('editor.total')}: {formatTime(duration)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className="glass rounded-full px-4 py-2 text-sm" onClick={() => onRange(clamp(current, 0, end - 0.05), end)}>{t('editor.setStart')}</button>
                    <button type="button" className="glass rounded-full px-4 py-2 text-sm" onClick={() => onRange(start, clamp(current, start + 0.05, duration))}>{t('editor.setEnd')}</button>
                    <label className="ms-auto flex items-center gap-3 text-sm">{t('editor.zoom')}<input type="range" min={1} max={20} step={0.5} value={zoom} className="w-40" onChange={(e) => setZoom(Number(e.target.value))} /></label>
                  </div>
                </div>
              )}

              {mode === 'simple' && (
                <div className="flex justify-center">
                  <GlassButton icon={<Play size={16} aria-hidden />} onClick={playSelection} disabled={!valid}>{t('editor.playSelection')}</GlassButton>
                </div>
              )}
            </GlassCard>

            <GlassCard className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t('editor.start')}>{(id) => <TimeInput id={id} value={start} max={Math.max(0, end - 0.05)} onChange={setStart} />}</Field>
                <Field label={t('editor.end')}>{(id) => <TimeInput id={id} value={end} max={duration} onChange={setEnd} />}</Field>
                <div><span className="label">{t('editor.selection')}</span><p className="py-2.5 text-sm tabular-nums" dir="ltr">{formatTime(Math.max(0, end - start))}</p></div>
              </div>
              <p className="hint">{t('editor.timeHint')}</p>
              {!valid && <p role="alert" className="rounded-2xl border border-ink px-4 py-3 text-sm">{t('editor.invalidTime')}</p>}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('editor.format')}>
                  {(id) => (
                    <select id={id} className="field" value={outFormat} onChange={(e) => setOutFormat(e.target.value)}>
                      {FORMATS[kind].map((f) => <option key={f} value={f}>{upper(f)}</option>)}
                    </select>
                  )}
                </Field>
                <div>
                  <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={precise} onChange={(e) => setPrecise(e.target.checked)} />{t('editor.precise')}</label>
                  <p className="hint mt-1.5">{t('editor.preciseHint')}</p>
                </div>
              </div>
              <GlassButton variant="primary" size="lg" icon={<Scissors size={18} aria-hidden />} disabled={!valid} onClick={submit} className="self-start">{t('editor.trim')}</GlassButton>
            </GlassCard>
          </>
        )}
      </div>
    </>
  )
}
