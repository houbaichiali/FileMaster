import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Cropper, { Area } from 'react-easy-crop'
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
import { ToolHeader } from '../components/ToolHeader'
import { useProcessing } from '../hooks/useProcessing'
import { useToolFile } from '../hooks/useToolFile'
import { sourcePreviewUrl } from '../services/api'
import { FORMATS, upper } from '../utils/formats'
import { Crop } from 'lucide-react'

type Ratio = 'orig' | '1:1' | '4:3' | '16:9' | '9:16' | '3:2' | 'custom'
const RATIOS: Record<Exclude<Ratio, 'orig' | 'custom'>, number> = { '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9, '9:16': 9 / 16, '3:2': 3 / 2 }

/** Bake horizontal/vertical flips into a blob URL so the cropper shows (and measures) the flipped image. */
function useFlippedSrc(src: string, flipH: boolean, flipV: boolean) {
  const [flipped, setFlipped] = useState<string | null>(null)
  useEffect(() => {
    if (!flipH && !flipV) { setFlipped(null); return }
    let url: string | null = null
    let alive = true
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth; c.height = img.naturalHeight
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.translate(flipH ? c.width : 0, flipV ? c.height : 0)
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
      ctx.drawImage(img, 0, 0)
      c.toBlob((b) => { if (b && alive) { url = URL.createObjectURL(b); setFlipped(url) } })
    }
    img.src = src
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [src, flipH, flipV])
  return (flipH || flipV) && flipped ? flipped : src
}

function LivePreview({ src, area, rotation }: { src: string; area: Area | null; rotation: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!area) return
    const handle = setTimeout(() => {
      const img = new Image()
      img.onload = () => {
        try {
          const rad = (rotation * Math.PI) / 180
          const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad))
          const bw = img.width * cos + img.height * sin, bh = img.width * sin + img.height * cos
          const tmp = document.createElement('canvas'); tmp.width = bw; tmp.height = bh
          const tctx = tmp.getContext('2d'); const out = canvas.current; const octx = out?.getContext('2d')
          if (!tctx || !out || !octx) return
          tctx.translate(bw / 2, bh / 2); tctx.rotate(rad); tctx.drawImage(img, -img.width / 2, -img.height / 2)
          const scale = Math.min(1, 360 / area.width)
          out.width = Math.max(1, Math.round(area.width * scale)); out.height = Math.max(1, Math.round(area.height * scale))
          octx.drawImage(tmp, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height)
        } catch { /* canvas unavailable: preview is optional */ }
      }
      img.src = src
    }, 150)
    return () => clearTimeout(handle)
  }, [src, area, rotation])
  return <canvas ref={canvas} className="mx-auto max-h-60 max-w-full rounded-xl border border-line" aria-hidden />
}

export function ImageCropper() {
  const { t } = useTranslation()
  const { file, setFile } = useToolFile(['image'])
  const { state, run, reset } = useProcessing('image-edit')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [ratio, setRatio] = useState<Ratio>('orig')
  const [cw, setCw] = useState(1000)
  const [ch, setCh] = useState(1000)
  const [area, setArea] = useState<Area | null>(null)
  const [resizeW, setResizeW] = useState('')
  const [resizeH, setResizeH] = useState('')
  const [outFormat, setOutFormat] = useState('png')
  const [quality, setQuality] = useState(92)

  const src = file ? sourcePreviewUrl(file.id) : ''
  const shown = useFlippedSrc(src, flipH, flipV)

  useEffect(() => {
    if (!file) return
    setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); setFlipH(false); setFlipV(false); setRatio('orig')
    setCw(file.info.width ?? 1000); setCh(file.info.height ?? 1000); setResizeW(''); setResizeH(''); setArea(null)
    setOutFormat(file.format)
  }, [file])

  const aspect = useMemo(() => {
    if (!file) return 1
    const quarter = Math.abs(Math.round(rotation / 90)) % 2 === 1
    if (ratio === 'orig') { const a = (file.info.width ?? 1) / (file.info.height ?? 1); return quarter ? 1 / a : a }
    if (ratio === 'custom') return Math.max(0.05, Math.min(20, cw / Math.max(1, ch)))
    return RATIOS[ratio]
  }, [file, ratio, cw, ch, rotation])

  const reset_ = () => { setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); setFlipH(false); setFlipV(false); setRatio('orig'); setResizeW(''); setResizeH('') }

  const keepRatio = (which: 'w' | 'h', v: string) => {
    const n = v.replace(/\D/g, '')
    const ar = area && area.height ? area.width / area.height : aspect
    if (which === 'w') { setResizeW(n); setResizeH(n ? String(Math.max(1, Math.round(Number(n) / ar))) : '') }
    else { setResizeH(n); setResizeW(n ? String(Math.max(1, Math.round(Number(n) * ar))) : '') }
  }

  if (!file) {
    return (<><ToolHeader icon={<Crop size={24} aria-hidden />} title={t('image.title')} description={t('tools.image')} /><FileUploadZone accept={['image']} onUploaded={setFile} /></>)
  }

  const previewable = file.previewable
  const submit = () => {
    if (!area) return
    const w = Number(resizeW), h = Number(resizeH)
    void run('image/edit', {
      file_id: file.id, crop: { x: area.x, y: area.y, width: area.width, height: area.height }, rotate: rotation, flip_h: flipH, flip_v: flipV,
      resize: w || h ? { width: w || null, height: h || null } : null, output_format: outFormat, quality,
    })
  }

  return (
    <>
      <ToolHeader icon={<Crop size={24} aria-hidden />} title={t('image.title')} description={t('tools.image')} />
      <div className="flex flex-col gap-5">
        <FileChip file={file} onReplace={() => { setFile(null); reset() }} />
        {state.phase === 'running' && <ProcessingIndicator progress={state.progress} />}
        {state.phase === 'done' && <ResultCard jobId={state.jobId} result={state.result} onAnother={reset} />}
        {state.phase === 'error' && <ErrorNotice error={state.error} onRetry={reset} />}

        {state.phase !== 'running' && state.phase !== 'done' && !previewable && <p role="alert" className="rounded-2xl border border-ink px-4 py-3 text-sm">{t('errors.preview_not_available')}</p>}

        {state.phase !== 'running' && state.phase !== 'done' && previewable && (
          <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
            <GlassCard className="flex flex-col gap-4">
              <div className="relative h-[22rem] overflow-hidden rounded-2xl bg-track sm:h-[28rem]" dir="ltr" data-testid="cropper">
                <Cropper image={shown} crop={crop} zoom={zoom} rotation={rotation} aspect={aspect} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={(_, px) => setArea(px)} objectFit="contain" showGrid />
              </div>
              <p className="hint">{t('image.drag')}</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <FloatingActionButton label={t('image.rotateLeft')} icon={<RotateCcw size={18} aria-hidden />} onClick={() => setRotation((r) => r - 90)} />
                <FloatingActionButton label={t('image.rotateRight')} icon={<RotateCw size={18} aria-hidden />} onClick={() => setRotation((r) => r + 90)} />
                <FloatingActionButton label={t('image.flipH')} active={flipH} icon={<FlipHorizontal2 size={18} aria-hidden />} onClick={() => setFlipH((v) => !v)} />
                <FloatingActionButton label={t('image.flipV')} active={flipV} icon={<FlipVertical2 size={18} aria-hidden />} onClick={() => setFlipV((v) => !v)} />
                <FloatingActionButton label={t('common.reset')} icon={<Undo2 size={18} aria-hidden />} onClick={reset_} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('image.zoom')}>{(id) => <input id={id} type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />}</Field>
                <Field label={`${t('image.rotation')} (${Math.round(rotation)}°)`}>{(id) => <input id={id} type="range" min={-180} max={180} step={1} value={Math.max(-180, Math.min(180, rotation))} onChange={(e) => setRotation(Number(e.target.value))} />}</Field>
              </div>
            </GlassCard>

            <div className="flex flex-col gap-5">
              <GlassCard className="flex flex-col gap-4">
                <span className="label !mb-0">{t('image.ratio')}</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('image.ratio')}>
                  {(['orig', '1:1', '4:3', '16:9', '9:16', '3:2', 'custom'] as Ratio[]).map((r) => (
                    <button key={r} type="button" role="radio" aria-checked={ratio === r} onClick={() => setRatio(r)} className={`rounded-full px-3.5 py-1.5 text-sm transition ${ratio === r ? 'bg-ink text-ink-contrast' : 'glass hover:bg-glass-strong'}`}>
                      {r === 'orig' ? t('image.original') : r === 'custom' ? t('image.free') : r}
                    </button>
                  ))}
                </div>
                {ratio === 'custom' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t('common.width')}>{(id) => <input id={id} className="field" inputMode="numeric" value={cw} onChange={(e) => setCw(Number(e.target.value.replace(/\D/g, '')) || 1)} />}</Field>
                    <Field label={t('common.height')}>{(id) => <input id={id} className="field" inputMode="numeric" value={ch} onChange={(e) => setCh(Number(e.target.value.replace(/\D/g, '')) || 1)} />}</Field>
                    <p className="hint col-span-2">{t('image.customHint')}</p>
                  </div>
                )}
                {area && <p className="text-sm tabular-nums" dir="ltr">{t('image.cropSize')}: {t('image.dims', { w: Math.round(area.width), h: Math.round(area.height) })}</p>}
              </GlassCard>

              <GlassCard className="flex flex-col gap-4">
                <span className="label !mb-0">{t('image.resize')}</span>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('common.width')}>{(id) => <input id={id} className="field" inputMode="numeric" placeholder="px" value={resizeW} onChange={(e) => keepRatio('w', e.target.value)} />}</Field>
                  <Field label={t('common.height')}>{(id) => <input id={id} className="field" inputMode="numeric" placeholder="px" value={resizeH} onChange={(e) => keepRatio('h', e.target.value)} />}</Field>
                </div>
                <p className="hint">{t('image.resizeHint')}</p>
                <Field label={t('image.output')}>
                  {(id) => <select id={id} className="field" value={outFormat} onChange={(e) => setOutFormat(e.target.value)}>{FORMATS.image.map((f) => <option key={f} value={f}>{upper(f)}</option>)}</select>}
                </Field>
                {(outFormat === 'jpg' || outFormat === 'webp') && (
                  <Field label={`${t('common.quality')} (${quality})`}>{(id) => <input id={id} type="range" min={30} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />}</Field>
                )}
              </GlassCard>

              <GlassCard className="flex flex-col gap-3">
                <span className="label !mb-0">{t('image.preview')}</span>
                <LivePreview src={shown} area={area} rotation={rotation} />
              </GlassCard>
              <GlassButton variant="primary" size="lg" disabled={!area} onClick={submit} icon={<Crop size={18} aria-hidden />}>{t('image.apply')}</GlassButton>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
