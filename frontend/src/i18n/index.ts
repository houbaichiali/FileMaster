import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from '../locales/ar/translation.json'
import en from '../locales/en/translation.json'
import fr from '../locales/fr/translation.json'

export const LANGUAGES = ['fr', 'en', 'ar'] as const
export type Lang = (typeof LANGUAGES)[number]
export const LANG_KEY = 'fm-lang'

export function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'fr' || v === 'en' || v === 'ar') return v
  } catch {
    /* storage unavailable */
  }
  return 'fr' // default for first-time visitors
}

export function applyDocumentLang(lang: string) {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en }, ar: { translation: ar } },
  lng: readStoredLang(),
  fallbackLng: 'en',
  supportedLngs: [...LANGUAGES],
  interpolation: { escapeValue: false },
  returnNull: false,
})

applyDocumentLang(i18n.language)
i18n.on('languageChanged', (lng) => {
  applyDocumentLang(lng)
  try {
    localStorage.setItem(LANG_KEY, lng)
  } catch {
    /* ignore */
  }
})

export default i18n
