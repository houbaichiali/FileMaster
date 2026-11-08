import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../hooks/useTheme'

export function ThemeSwitcher() {
  const { t } = useTranslation()
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('theme.toggle')}
      title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
      data-testid="theme-switcher"
      className="glass flex h-10 w-10 items-center justify-center rounded-full text-fg transition hover:bg-glass-strong active:scale-95"
    >
      {theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  )
}
