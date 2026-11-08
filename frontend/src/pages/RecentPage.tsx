import { Download, History, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buttonClass, GlassButton } from '../components/GlassButton'
import { GlassCard } from '../components/GlassCard'
import { GlassModal } from '../components/GlassModal'
import { ToolHeader } from '../components/ToolHeader'
import { useRecent } from '../hooks/useRecent'
import { isJobAvailable, jobDownloadUrl } from '../services/api'
import { formatBytes } from '../utils/format'

export default function RecentPage() {
  const { t, i18n } = useTranslation()
  const { entries, remove, clear } = useRecent()
  const [available, setAvailable] = useState<Record<string, boolean>>({})
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    let alive = true
    entries.forEach((e) => void isJobAvailable(e.jobId).then((ok) => alive && setAvailable((a) => ({ ...a, [e.jobId]: ok }))))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length])

  return (
    <>
      <ToolHeader icon={<History size={24} aria-hidden />} title={t('recent.title')} />
      {entries.length === 0 ? (
        <GlassCard className="text-center text-fg-2">{t('recent.empty')}</GlassCard>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end"><GlassButton size="sm" icon={<Trash2 size={14} aria-hidden />} onClick={() => setConfirm(true)}>{t('recent.clear')}</GlassButton></div>
          <ul className="flex flex-col gap-3" data-testid="recent-list">
            {entries.map((e) => (
              <li key={e.jobId}>
                <GlassCard className="flex flex-wrap items-center gap-3 !p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium" dir="auto">{e.filename}</p>
                    <p className="text-xs text-fg-2">{t(`recent.tools.${e.tool}`)} · {formatBytes(e.size, i18n.language)} · {new Date(e.date).toLocaleString(i18n.language)}</p>
                  </div>
                  {available[e.jobId] === false
                    ? <span className="rounded-full border border-line px-3 py-1 text-xs text-fg-2">{t('recent.expired')}</span>
                    : <a href={jobDownloadUrl(e.jobId)} download={e.filename} className={buttonClass('primary', 'sm')}><Download size={14} aria-hidden />{t('common.download')}</a>}
                  <button type="button" onClick={() => remove(e.jobId)} aria-label={t('recent.removeOne')} title={t('recent.removeOne')} className="rounded-full p-2 text-fg-2 hover:bg-glass"><X size={16} aria-hidden /></button>
                </GlassCard>
              </li>
            ))}
          </ul>
        </div>
      )}
      <GlassModal open={confirm} title={t('recent.clear')} onClose={() => setConfirm(false)}
        footer={<><GlassButton onClick={() => setConfirm(false)}>{t('common.cancel')}</GlassButton><GlassButton variant="primary" onClick={() => { clear(); setConfirm(false) }}>{t('common.confirm')}</GlassButton></>}>
        {t('recent.clearConfirm')}
      </GlassModal>
    </>
  )
}
