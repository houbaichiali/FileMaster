import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GlassNavbar } from './GlassNavbar'
import { GlassSidebar } from './GlassSidebar'

export function AppLayout() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen">
      <a href="#content" className="glass-strong sr-only z-50 rounded-full px-4 py-2 focus:not-sr-only focus:fixed focus:start-4 focus:top-4">{t('nav.skip')}</a>
      <GlassSidebar />
      <div className="min-w-0 flex-1 px-4 md:ps-2 md:pe-6">
        <div className="mx-auto w-full max-w-5xl">
          <GlassNavbar />
          <main id="content" className="pb-28 md:pb-12">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
