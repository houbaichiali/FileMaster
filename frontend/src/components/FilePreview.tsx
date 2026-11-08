import { File as FileIcon, FileText, Film, Image as ImageIcon, Music } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Kind } from '../services/api'

export const KIND_ICON = { image: ImageIcon, document: FileText, audio: Music, video: Film }

interface Props { kind: Kind; format: string; src?: string; name: string; previewable?: boolean }

export function FilePreview({ kind, format, src, name, previewable = true }: Props) {
  const { t } = useTranslation()
  if (!src || !previewable) {
    const Icon = KIND_ICON[kind] ?? FileIcon
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-line p-8 text-center text-fg-2">
        <Icon size={32} aria-hidden />
        <span className="break-all text-sm text-fg">{name}</span>
        <span className="text-xs">{t('result.noPreview')}</span>
      </div>
    )
  }
  if (kind === 'image') return <img src={src} alt={name} className="mx-auto max-h-96 rounded-2xl object-contain" />
  if (kind === 'audio') return <audio controls src={src} className="w-full" aria-label={name} />
  if (kind === 'video') return <video controls playsInline src={src} className="max-h-96 w-full rounded-2xl bg-black" aria-label={name} />
  if (format === 'pdf') return <iframe src={src} title={name} className="h-[28rem] w-full rounded-2xl border border-line bg-white" />
  return null
}
