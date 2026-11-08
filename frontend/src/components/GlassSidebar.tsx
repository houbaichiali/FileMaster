import { AudioLines, ArrowLeftRight, Clapperboard, Crop, FileDown, History, House, Settings, FileStack } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cx } from '../utils/format'

export const NAV = [
  { to: '/', key: 'home', icon: House },
  { to: '/convert', key: 'convert', icon: ArrowLeftRight },
  { to: '/compress', key: 'compress', icon: FileDown },
  { to: '/image', key: 'image', icon: Crop },
  { to: '/audio', key: 'audio', icon: AudioLines },
  { to: '/video', key: 'video', icon: Clapperboard },
  { to: '/recent', key: 'recent', icon: History },
  { to: '/settings', key: 'settings', icon: Settings },
] as const

export function GlassSidebar() {
  const { t } = useTranslation()
  return (
    <>
      <aside className="glass sticky top-4 m-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 flex-col rounded-4xl p-4 md:flex">
        <div className="flex items-center gap-3 px-3 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-ink-contrast"><FileStack size={20} aria-hidden /></span>
          <span className="text-lg font-semibold tracking-tight">{t('app.name')}</span>
        </div>
        <nav aria-label={t('nav.menu')} className="mt-2 flex flex-1 flex-col gap-1">
          {NAV.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cx('flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition', isActive ? 'bg-ink text-ink-contrast' : 'text-fg-2 hover:bg-glass-strong hover:text-fg')
              }
            >
              <Icon size={18} aria-hidden />
              {t(`nav.${key}`)}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile: floating dock */}
      <nav aria-label={t('nav.menu')} className="glass fixed inset-x-3 bottom-3 z-40 flex gap-1 overflow-x-auto rounded-full p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden">
        {NAV.map(({ to, key, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={t(`nav.${key}`)}
            title={t(`nav.${key}`)}
            className={({ isActive }) => cx('flex h-11 min-w-11 flex-1 items-center justify-center rounded-full transition', isActive ? 'bg-ink text-ink-contrast' : 'text-fg-2')}
          >
            <Icon size={19} aria-hidden />
          </NavLink>
        ))}
      </nav>
    </>
  )
}
