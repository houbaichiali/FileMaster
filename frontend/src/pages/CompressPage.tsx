import { FileDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorNotice } from '../components/ErrorNotice'
import { Field } from '../components/Field'
import { FileChip } from '../components/FileChip'
import { FileUploadZone } from '../components/FileUploadZone'
import { GlassButton } from '../components/GlassButton'
import { GlassCard } from '../components/GlassCard'
import { ProcessingIndicator } from '../components/ProcessingIndicator'
import { ResultCard } from '../components/ResultCard'
import { Segmented } from '../components/Segmented'
import { ToolHeader } from '../components/ToolHeader'
import { useProcessing } from '../hooks/useProcessing'
import { useToolFile } from '../hooks/useToolFile'
import { FORMATS, KINDS, upper } from '../utils/formats'

type Level = 'low' | 'medium' | 'high' | 'maximum'
const LEVELS: Level[] = ['low', 'medium', 'high', 'maximum']
const LOSSY = ['mp3', 'aac', 'ogg', 'm4a']
const num = (v: string) => (v.trim() && Number(v) > 0 ? Number(v) : undefined)

export default function CompressPage() {
  const { t } = useTranslation()
  const { file, setFile } = useToolFile(KINDS)
  const { state, run, reset } = useProcessing('compress')
  const [level, setLevel] = useState<Level>('medium')
  const [useTarget, setUseTarget] = useState(false)
  const [targetMb, setTargetMb] = useState('')
  const [quality, setQuality] = useState('')
  const [maxW, setMaxW] = useState('')
  const [maxH, setMaxH] = useState('')
  const [outFormat, setOutFormat] = useState('')
  const [bitrate, setBitrate] = useState('')
  const [resolution, setResolution] = useState('')
  const [codec, setCodec] = useState('')
  const [vBitrate, setVBitrate] = useState('')

  useEffect(() => { setOutFormat(''); setUseTarget(false); setTargetMb(''); setCodec('') }, [file])

  const header = <ToolHeader icon={<FileDown size={24} aria-hidden />} title={t('compress.title')} description={t('tools.compress')} />
  if (!file) return <>{header}<FileUploadZone onUploaded={setFile} /></>

  const supported = file.kind !== 'document' || file.format === 'pdf'
  const unsupported = !supported || file.format === 'bmp' && !outFormat
  const outF = outFormat || file.format
  const formatChoices = file.kind === 'image' ? FORMATS.image.filter((f) => f !== 'bmp') : file.kind === 'audio' ? FORMATS.audio : file.kind === 'video' ? FORMATS.video : []
  const lossless = file.kind === 'audio' && !LOSSY.includes(outF)

  const submit = () => {
    const body: Record<string, unknown> = { file_id: file.id, level }
    if (useTarget && num(targetMb)) body.target_size_mb = num(targetMb)
    if (outFormat && outFormat !== file.format) body.output_format = outFormat
    if (file.kind === 'image') { if (num(quality)) body.quality = Math.min(100, num(quality)!); if (num(maxW)) body.max_width = num(maxW); if (num(maxH)) body.max_height = num(maxH) }
    if (file.kind === 'audio' && LOSSY.includes(outF) && num(bitrate)) body.bitrate_kbps = num(bitrate)
    if (file.kind === 'video') { if (num(resolution)) body.resolution = num(resolution); if (codec) body.codec = codec; if (num(vBitrate) && !useTarget) body.video_bitrate_kbps = num(vBitrate) }
    void run('compress', body)
  }
  const codecs = outF === 'webm' ? ['vp9'] : ['h264', 'h265']

  return (
    <>
      {header}
      <div className="flex flex-col gap-5">
        <FileChip file={file} onReplace={() => { setFile(null); reset() }} />
        {state.phase === 'running' && <ProcessingIndicator progress={state.progress} />}
        {state.phase === 'done' && <ResultCard jobId={state.jobId} result={state.result} onAnother={() => { reset(); setFile(null) }} />}
        {state.phase === 'error' && <ErrorNotice error={state.error} onRetry={reset} />}

        {(state.phase === 'idle' || state.phase === 'error') && (
          <GlassCard className="flex flex-col gap-6">
            {!supported && <p role="alert" className="rounded-2xl border border-ink px-4 py-3 text-sm">{t('compress.notSupported')}</p>}
            {supported && (
              <>
                <div>
                  <span className="label">{t('compress.level')}</span>
                  <Segmented ariaLabel={t('compress.level')} value={level} onChange={setLevel} className="!grid-cols-2 sm:!grid-cols-4"
                    options={LEVELS.map((l) => ({ value: l, label: t(`compress.levels.${l}.name`), hint: t(`compress.levels.${l}.hint`) }))} />
                </div>
                {file.format === 'pdf' && <p className="hint">{t('compress.pdfNote')}</p>}
                {file.format === 'bmp' && !outFormat && <p className="hint">{t('compress.notSupported')}</p>}

                <details className="group" open={file.format === 'bmp'}>
                  <summary className="cursor-pointer font-medium">{t('compress.advanced')}</summary>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {formatChoices.length > 0 && (
                      <Field label={t('compress.outputFormat')}>
                        {(id) => <select id={id} className="field" value={outFormat} onChange={(e) => setOutFormat(e.target.value)}>
                          <option value="">{t('compress.sameFormat')}</option>
                          {formatChoices.filter((f) => f !== file.format).map((f) => <option key={f} value={f}>{upper(f)}</option>)}
                        </select>}
                      </Field>
                    )}
                    {file.kind === 'image' && (
                      <>
                        {(outF === 'jpg' || outF === 'webp') && <Field label={`${t('common.quality')} (1–100)`}>{(id) => <input id={id} className="field" inputMode="numeric" placeholder={t('compress.auto')} value={quality} onChange={(e) => setQuality(e.target.value.replace(/\D/g, ''))} />}</Field>}
                        <Field label={t('compress.maxWidth')}>{(id) => <input id={id} className="field" inputMode="numeric" placeholder={t('compress.auto')} value={maxW} onChange={(e) => setMaxW(e.target.value.replace(/\D/g, ''))} />}</Field>
                        <Field label={t('compress.maxHeight')}>{(id) => <input id={id} className="field" inputMode="numeric" placeholder={t('compress.auto')} value={maxH} onChange={(e) => setMaxH(e.target.value.replace(/\D/g, ''))} />}</Field>
                      </>
                    )}
                    {file.kind === 'audio' && LOSSY.includes(outF) && (
                      <Field label={t('compress.bitrate')}>{(id) => <select id={id} className="field" value={bitrate} onChange={(e) => setBitrate(e.target.value)}><option value="">{t('compress.auto')}</option>{[320, 256, 192, 128, 96, 64, 48, 32].map((b) => <option key={b} value={b}>{b}</option>)}</select>}</Field>
                    )}
                    {file.kind === 'video' && (
                      <>
                        <Field label={t('compress.resolution')}>{(id) => <select id={id} className="field" value={resolution} onChange={(e) => setResolution(e.target.value)}><option value="">{t('compress.auto')}</option>{[1080, 720, 480, 360, 240].map((r) => <option key={r} value={r}>{r}p</option>)}</select>}</Field>
                        <Field label={t('compress.codec')}>{(id) => <select id={id} className="field" value={codec} onChange={(e) => setCodec(e.target.value)}><option value="">{t('compress.auto')}</option>{codecs.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select>}</Field>
                        {!useTarget && <Field label={t('compress.videoBitrate')}>{(id) => <input id={id} className="field" inputMode="numeric" placeholder={t('compress.auto')} value={vBitrate} onChange={(e) => setVBitrate(e.target.value.replace(/\D/g, ''))} />}</Field>}
                      </>
                    )}
                  </div>
                  {lossless && <p className="hint mt-4">{t('compress.losslessNote')}</p>}
                </details>

                {!lossless && (
                  <div>
                    <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={useTarget} onChange={(e) => setUseTarget(e.target.checked)} />{t('compress.targetSize')}</label>
                    {useTarget && (
                      <div className="mt-3 max-w-xs">
                        <Field label={t('compress.targetMb')} hint={t('compress.targetHint')}>{(id) => <input id={id} className="field" inputMode="decimal" value={targetMb} onChange={(e) => setTargetMb(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} />}</Field>
                      </div>
                    )}
                  </div>
                )}
                <GlassButton variant="primary" size="lg" className="self-start" disabled={unsupported || (useTarget && !num(targetMb))} onClick={submit}>{t('compress.run')}</GlassButton>
              </>
            )}
          </GlassCard>
        )}
      </div>
    </>
  )
}
