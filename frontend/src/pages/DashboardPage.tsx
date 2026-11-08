import { ArrowLeftRight, AudioLines, Clapperboard, Crop, FileDown, History } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileChip } from '../components/FileChip'
import { FileUploadZone } from '../components/FileUploadZone'
import { buttonClass } from '../components/GlassButton'
import { GlassCard } from '../components/GlassCard'
import { useFileSession } from '../hooks/useFileSession'
import { useRecent } from '../hooks/useRecent'
import { FORMATS, KINDS, upper } from '../utils/formats'
import { formatBytes } from '../utils/format'

const TOOLS = [
  { to: '/convert', key: 'convert', icon: ArrowLeftRight },
  { to: '/compress', key: 'compress', icon: FileDown },
  { to: '/image', key: 'image', icon: Crop },
  { to: '/audio', key: 'audio', icon: AudioLines },
  { to: '/video', key: 'video', icon: Clapperboard },
] as const

export default function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { file, setFile } = useFileSession()
  const { entries } = useRecent()
  const navigate = useNavigate()
  const actions = file ? [
    file.targets.length > 0 && { to: '/convert', label: t('nav.convert') },
    (file.kind !== 'document' || file.format === 'pdf') && { to: '/compress', label: t('nav.compress') },
    file.kind === 'image' && { to: '/image', label: t('nav.image') },
    file.kind === 'audio' && { to: '/audio', label: t('nav.audio') },
    file.kind === 'video' && { to: '/video', label: t('nav.video') },
  ].filter(Boolean) as { to: string; label: string }[] : []

  return (
    <div className="flex flex-col gap-10">
      <section className="pt-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('dashboard.title')}</h1>
        <p className="mt-3 max-w-2xl text-fg-2">{t('dashboard.subtitle')}</p>
      </section>

      <section aria-labelledby="start-h" className="flex flex-col gap-4">
        <h2 id="start-h" className="sr-only">{t('dashboard.uploadTitle')}</h2>
        {file ? (
          <>
            <FileChip file={file} onReplace={() => setFile(null)} />
            <GlassCard>
              <p className="mb-4 font-medium">{t('dashboard.next', { name: file.original_name })}</p>
              <div className="flex flex-wrap gap-3">
                {actions.map((a, i) => <button key={a.to} type="button" className={buttonClass(i === 0 ? 'primary' : 'glass', 'lg')} onClick={() => navigate(a.to)}>{a.label}</button>)}
              </div>
            </GlassCard>
          </>
        ) : <FileUploadZone accept={KINDS} onUploaded={setFile} />}
      </section>

      <section aria-labelledby="tools-h">
        <h2 id="tools-h" className="mb-4 text-lg font-semibold">{t('dashboard.tools')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(({ to, key, icon: Icon }) => (
            <Link key={to} to={to} className="block rounded-3xl">
              <GlassCard interactive className="h-full">
                <span className="glass-strong mb-4 flex h-12 w-12 items-center justify-center rounded-full"><Icon size={22} aria-hidden /></span>
                <h3 className="font-semibold">{t(`nav.${key}`)}</h3>
                <p className="mt-1 text-sm text-fg-2">{t(`tools.${key}`)}</p>
              </GlassCard>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="recent-h">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="recent-h" className="text-lg font-semibold">{t('dashboard.recent')}</h2>
          {entries.length > 0 && <Link to="/recent" className="text-sm text-fg-2 underline-offset-4 hover:underline">{t('dashboard.seeAll')}</Link>}
        </div>
        {entries.length === 0 ? (
          <GlassCard className="flex items-center gap-3 text-sm text-fg-2"><History size={18} aria-hidden />{t('dashboard.noRecent')}</GlassCard>
        ) : (
          <ul className="grid gap-3">
            {entries.slice(0, 3).map((e) => (
              <li key={e.jobId}><GlassCard className="flex items-center justify-between gap-3 !p-4"><span className="truncate" dir="auto">{e.filename}</span><span className="shrink-0 text-xs text-fg-2">{t(`recent.tools.${e.tool}`)} · {formatBytes(e.size, i18n.language)}</span></GlassCard></li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="formats-h">
        <h2 id="formats-h" className="mb-1 text-lg font-semibold">{t('dashboard.formats')}</h2>
        <p className="hint mb-4">{t('dashboard.formatsNote')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {KINDS.map((k) => (
            <GlassCard key={k} className="!p-4">
              <p className="mb-2 text-sm font-medium">{t(`kinds.${k}`)}</p>
              <div className="flex flex-wrap gap-1.5" dir="ltr">{FORMATS[k].map((f) => <span key={f} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-fg-2">{upper(f)}</span>)}</div>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  )
}
