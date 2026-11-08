import { Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassButton } from '../components/GlassButton'
import { GlassCard } from '../components/GlassCard'
import { Segmented } from '../components/Segmented'
import { ToolHeader } from '../components/ToolHeader'
import { useFormats } from '../hooks/useFormats'
import { useRecent } from '../hooks/useRecent'
import { useSettings } from '../hooks/useSettings'
import { Theme, useTheme } from '../hooks/useTheme'
import { LANGUAGES, Lang } from '../i18n'
import { getHealth } from '../services/api'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { settings, update } = useSettings()
  const { ttl_minutes, max_upload_mb } = useFormats()
  const { clear, entries } = useRecent()
  const [server, setServer] = useState<'ok' | 'noffmpeg' | 'down' | null>(null)

  useEffect(() => { getHealth().then((h) => setServer(h.ffmpeg && h.ffprobe ? 'ok' : 'noffmpeg')).catch(() => setServer('down')) }, [])

  return (
    <>
      <ToolHeader icon={<Settings size={24} aria-hidden />} title={t('settings.title')} />
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard className="flex flex-col gap-5">
          <h2 className="font-semibold">{t('settings.appearance')}</h2>
          <div>
            <span className="label">{t('settings.theme')}</span>
            <Segmented<Theme> ariaLabel={t('settings.theme')} value={theme} onChange={setTheme} options={[{ value: 'light', label: t('theme.light') }, { value: 'dark', label: t('theme.dark') }]} />
          </div>
          <div>
            <span className="label">{t('settings.language')}</span>
            <Segmented<Lang> ariaLabel={t('settings.language')} value={i18n.language as Lang} onChange={(l) => void i18n.changeLanguage(l)} options={LANGUAGES.map((l) => ({ value: l, label: t(`language.${l}`) }))} />
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col gap-4">
          <h2 className="font-semibold">{t('settings.processing')}</h2>
          <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={settings.preciseCut} onChange={(e) => update({ preciseCut: e.target.checked })} />{t('settings.preciseDefault')}</label>
          <p className="hint">{t('settings.preciseDefaultHint')}</p>
          <GlassButton size="sm" className="self-start" disabled={entries.length === 0} onClick={clear}>{t('settings.clearRecent')}</GlassButton>
        </GlassCard>

        <GlassCard className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('settings.storage')}</h2>
          <p className="text-sm text-fg-2">{t('settings.storageText', { minutes: ttl_minutes })}</p>
          <p className="text-sm"><span className="text-fg-2">{t('settings.maxUpload')} : </span>{t('settings.mb', { mb: max_upload_mb })}</p>
        </GlassCard>

        <GlassCard className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('settings.about')}</h2>
          <p className="text-sm text-fg-2">{t('settings.aboutText')}</p>
          <p className="text-sm"><span className="text-fg-2">{t('settings.version')} : </span>1.0.0</p>
          <p className="text-sm" data-testid="server-status"><span className="text-fg-2">{t('settings.server')} : </span>{server === null ? t('common.loading') : server === 'ok' ? t('settings.serverOk') : server === 'noffmpeg' ? t('settings.serverNoFfmpeg') : t('settings.serverDown')}</p>
        </GlassCard>
      </div>
    </>
  )
}
