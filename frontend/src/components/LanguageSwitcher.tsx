import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n'
import { cx } from '../utils/format'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  return (
    <div role="group" aria-label={t('language.label')} className="glass flex rounded-full p-1" data-testid="language-switcher">
      {LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          lang={lng}
          aria-pressed={i18n.language === lng}
          onClick={() => void i18n.changeLanguage(lng)}
          className={cx(
            'rounded-full px-3 py-1.5 text-sm font-medium transition',
            i18n.language === lng ? 'bg-ink text-ink-contrast' : 'text-fg-2 hover:text-fg',
          )}
        >
          {t(`language.${lng}`)}
        </button>
      ))}
    </div>
  )
}
