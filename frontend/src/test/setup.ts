import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { clearRecent } from '../hooks/useRecent'
import i18n from '../i18n'

afterEach(async () => {
  cleanup()
  clearRecent()
  localStorage.clear()
  document.documentElement.setAttribute('data-theme', 'light')
  await i18n.changeLanguage('fr')
})
