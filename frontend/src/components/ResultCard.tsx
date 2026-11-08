import { CheckCircle2, Download, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormats } from '../hooks/useFormats'
import { JobResult, Kind, jobDownloadUrl, jobPreviewUrl } from '../services/api'
import { formatBytes } from '../utils/format'
import { buttonClass, GlassButton } from './GlassButton'
import { GlassCard } from './GlassCard'
import { FilePreview } from './FilePreview'

const DETAIL_KEYS = ['quality', 'scale', 'colors', 'bitrate_kbps', 'video_bitrate_kbps', 'codec', 'crf', 'height', 'sample_rate', 'channels', 'mode', 'pages', 'width', 'level'] as const
const IMG = ['jpg', 'png', 'webp', 'bmp', 'tiff']
const AUD = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a']
const VID = ['mp4', 'mov', 'webm', 'mkv']
const kindOf = (f: string): Kind => (IMG.includes(f) ? 'image' : AUD.includes(f) ? 'audio' : VID.includes(f) ? 'video' : 'document')

export function ResultCard({ jobId, result, onAnother }: { jobId: string; result: JobResult; onAnother: () => void }) {
  const { t, i18n } = useTranslation()
  const { ttl_minutes } = useFormats()
  const fmt = (n: number) => formatBytes(n, i18n.language)
  const pct = Math.abs(result.saved_percent)
  const d = result.details
  const rows = DETAIL_KEYS.filter((k) => d[k] !== undefined && d[k] !== null).map((k) => {
    let value = String(d[k])
    if (k === 'mode') value = t(`details.modeValues.${value}`)
    if (k === 'scale') value = `× ${value}`
    return { k, value }
  })
  const showSavings = result.original_size > 0
  return (
    <GlassCard className="flex flex-col gap-5" data-testid="result-card">
      <div className="flex items-center gap-3">
        <CheckCircle2 size={26} aria-hidden />
        <h2 className="text-xl font-semibold">{t('result.title')}</h2>
      </div>

      {showSavings && (
        <div>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div><dt className="hint">{t('result.original')}</dt><dd className="mt-1 font-semibold tabular-nums">{fmt(result.original_size)}</dd></div>
            <div><dt className="hint">{t('result.newSize')}</dt><dd className="mt-1 font-semibold tabular-nums">{fmt(result.size)}</dd></div>
            <div>
              <dt className="hint">{t('result.saved')}</dt>
              <dd className="mt-1 font-semibold tabular-nums">
                {result.saved_percent > 0 ? t('result.smaller', { percent: pct }) : result.saved_percent < 0 ? t('result.larger', { percent: pct }) : t('result.same')}
              </dd>
            </div>
          </dl>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-track" aria-hidden>
            <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, Math.round((result.size / result.original_size) * 100))}%` }} />
          </div>
        </div>
      )}

      {d.already_optimal === true && <p className="rounded-2xl border border-line px-4 py-3 text-sm">{t('result.alreadyOptimal')}</p>}
      {d.target_reached === true && <p className="rounded-2xl border border-line px-4 py-3 text-sm">{t('result.targetReached')}</p>}
      {d.target_reached === false && <p role="alert" className="rounded-2xl border border-ink px-4 py-3 text-sm">{t('result.targetMissed')}</p>}

      <p className="text-sm"><span className="text-fg-2">{t('result.outputName')} : </span><span className="break-all font-medium" dir="auto">{result.filename}</span></p>

      {rows.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">{t('result.settings')}</summary>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {rows.map((r) => <div key={r.k}><dt className="hint">{t(`details.${r.k}`)}</dt><dd className="tabular-nums">{r.value}</dd></div>)}
          </dl>
        </details>
      )}

      <FilePreview kind={kindOf(result.format)} format={result.format} name={result.filename} src={jobPreviewUrl(jobId)} previewable={result.previewable} />

      <div className="flex flex-wrap items-center gap-3">
        <a href={jobDownloadUrl(jobId)} download={result.filename} className={buttonClass('primary', 'lg')} data-testid="download-link">
          <Download size={18} aria-hidden /> {t('common.download')}
        </a>
        <GlassButton size="lg" icon={<RotateCcw size={16} aria-hidden />} onClick={onAnother}>{t('common.another')}</GlassButton>
      </div>
      <p className="hint">{t('result.expires', { minutes: ttl_minutes })}</p>
    </GlassCard>
  )
}
