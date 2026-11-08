import { useTranslation } from 'react-i18next'
import { ApiError } from '../services/api'

export function useErrorText() {
  const { t, i18n } = useTranslation()
  return (err: unknown): string => {
    const e = err instanceof ApiError ? err : new ApiError('internal')
    const key = `errors.${e.code}`
    return i18n.exists(key) ? t(key, e.params as Record<string, string>) : t('errors.internal')
  }
}
