import { FileStack } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeSwitcher } from './ThemeSwitcher'

export function GlassNavbar() {
  const { t } = useTranslation()
  return (
    <header className="flex items-center justify-between gap-3 py-4">
      <div className="flex items-center gap-2 md:invisible">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-ink-contrast"><FileStack size={18} aria-hidden /></span>
        <span className="font-semibold">{t('app.name')}</span>
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
    </header>
  )
}
