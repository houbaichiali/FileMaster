import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from './GlassCard'

export function ProcessingIndicator({ progress = 0, label }: { progress?: number; label?: string }) {
  const { t } = useTranslation()
  const pct = Math.round(progress * 100)
  return (
    <GlassCard role="status" aria-live="polite" className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-sm font-medium">
        <Loader2 size={18} className="animate-spin" aria-hidden />
        <span>{label ?? t('common.processing')}</span>
        {pct > 0 && <span className="ms-auto tabular-nums text-fg-2">{pct}%</span>}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-track" aria-hidden>
        <div className={pct > 0 ? 'h-full rounded-full bg-ink transition-all' : 'h-full w-1/3 animate-pulse rounded-full bg-ink'} style={pct > 0 ? { width: `${pct}%` } : undefined} />
      </div>
    </GlassCard>
  )
}
