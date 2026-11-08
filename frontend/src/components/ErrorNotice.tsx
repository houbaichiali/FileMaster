import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useErrorText } from '../hooks/useErrorText'
import { ApiError } from '../services/api'
import { GlassButton } from './GlassButton'

export function ErrorNotice({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const { t } = useTranslation()
  const text = useErrorText()
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-3xl border-2 border-ink px-5 py-4 text-sm">
      <AlertCircle size={20} aria-hidden />
      <span className="min-w-0 flex-1">{text(error)}</span>
      {onRetry && <GlassButton size="sm" onClick={onRetry}>{t('common.retry')}</GlassButton>}
    </div>
  )
}
