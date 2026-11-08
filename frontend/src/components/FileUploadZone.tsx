import { motion } from 'framer-motion'
import { AlertCircle, UploadCloud } from 'lucide-react'
import { DragEvent, KeyboardEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useErrorText } from '../hooks/useErrorText'
import { useFormats } from '../hooks/useFormats'
import { ApiError, FileMeta, Kind, deleteFile, uploadFile } from '../services/api'
import { FORMATS, acceptAttr, upper } from '../utils/formats'
import { cx } from '../utils/format'
import { GlassCard } from './GlassCard'
import { ProcessingIndicator } from './ProcessingIndicator'

interface Props { accept?: Kind[]; onUploaded: (meta: FileMeta) => void; compact?: boolean }

export function FileUploadZone({ accept = ['image', 'document', 'audio', 'video'], onUploaded, compact }: Props) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { max_upload_mb } = useFormats()
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = progress !== null

  async function handle(file: File | undefined) {
    if (!file || busy) return
    setError(null)
    if (file.size > max_upload_mb * 1024 * 1024) return setError(t('upload.tooLarge', { mb: max_upload_mb }))
    setProgress(0)
    try {
      const meta = await uploadFile(file, setProgress)
      if (!accept.includes(meta.kind)) {
        void deleteFile(meta.id).catch(() => undefined)
        throw Object.assign(new Error('kind'), { kind: meta.kind })
      }
      onUploaded(meta)
    } catch (e) {
      if (e instanceof ApiError) setError(errorText(e))
      else setError(t('upload.wrongKind', { kind: t(`kinds.${(e as { kind?: Kind }).kind ?? 'document'}`).toLowerCase() }))
    } finally {
      setProgress(null)
      if (input.current) input.current.value = ''
    }
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); void handle(e.dataTransfer.files?.[0]) }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click() } }
  const formats = accept.flatMap((k) => FORMATS[k]).map(upper).join(', ')

  if (busy) return <ProcessingIndicator progress={progress === 1 ? 0 : progress ?? 0} label={progress === 1 ? t('upload.analyzing') : t('upload.uploading')} />

  return (
    <div>
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={t('upload.aria')}
        data-testid="upload-zone"
        onClick={() => input.current?.click()}
        onKeyDown={onKey}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        animate={{ scale: drag ? 1.015 : 1 }}
        className="cursor-pointer"
      >
        <GlassCard className={cx('flex flex-col items-center gap-3 border-2 border-dashed text-center transition', compact ? 'py-8' : 'py-14', drag ? 'border-ink bg-glass-strong' : 'border-line')}>
          <span className="glass-strong flex h-16 w-16 items-center justify-center rounded-full"><UploadCloud size={28} aria-hidden /></span>
          <p className="text-lg font-medium">{drag ? t('upload.dropActive') : t('upload.dropTitle')}</p>
          <p className="text-sm text-fg-2">{t('upload.browse')}</p>
          <p className="hint max-w-md">{t('upload.accepts', { formats })} · {t('upload.maxSize', { mb: max_upload_mb })}</p>
        </GlassCard>
        <input ref={input} type="file" hidden accept={acceptAttr(accept)} data-testid="file-input" onChange={(e) => void handle(e.target.files?.[0])} />
      </motion.div>
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl border border-ink px-4 py-3 text-sm">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </div>
  )
}
