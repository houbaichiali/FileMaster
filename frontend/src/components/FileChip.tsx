import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FileMeta } from '../services/api'
import { formatBytes } from '../utils/format'
import { upper } from '../utils/formats'
import { GlassButton } from './GlassButton'
import { GlassCard } from './GlassCard'
import { KIND_ICON } from './FilePreview'

export function FileChip({ file, onReplace }: { file: FileMeta; onReplace: () => void }) {
  const { t, i18n } = useTranslation()
  const Icon = KIND_ICON[file.kind]
  const dur = file.info.duration
  return (
    <GlassCard className="flex flex-wrap items-center gap-4 !p-4">
      <span className="glass-strong flex h-12 w-12 items-center justify-center rounded-full"><Icon size={22} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" dir="auto">{file.original_name}</p>
        <p className="text-xs text-fg-2">
          {upper(file.format)} · {formatBytes(file.size, i18n.language)}
          {file.info.width ? ` · ${file.info.width}×${file.info.height}` : ''}
          {dur ? ` · ${Math.floor(dur / 60)}:${String(Math.floor(dur % 60)).padStart(2, '0')}` : ''}
        </p>
      </div>
      <GlassButton size="sm" icon={<RefreshCw size={14} aria-hidden />} onClick={onReplace}>{t('common.replace')}</GlassButton>
    </GlassCard>
  )
}
