import { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cx } from '../utils/format'

type Variant = 'primary' | 'glass' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

export function buttonClass(variant: Variant = 'glass', size: Size = 'md', extra?: string) {
  return cx(
    'inline-flex select-none items-center justify-center gap-2 rounded-full font-medium transition duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
    size === 'sm' && 'px-3.5 py-1.5 text-sm',
    size === 'md' && 'px-5 py-2.5 text-sm',
    size === 'lg' && 'px-7 py-3.5 text-base',
    variant === 'primary' && 'bg-ink text-ink-contrast hover:opacity-90',
    variant === 'glass' && 'glass text-fg hover:bg-glass-strong',
    variant === 'ghost' && 'text-fg hover:bg-glass',
    extra,
  )
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export function GlassButton({ variant, size, loading, icon, children, className, disabled, type = 'button', ...rest }: Props) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}
