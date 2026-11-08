import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { cx } from '../utils/format'

interface Props {
  label: string
  icon: ReactNode
  onClick?: () => void
  disabled?: boolean
  primary?: boolean
  active?: boolean
  size?: 'md' | 'lg'
  showLabel?: boolean
}

/** Circular floating control inspired by FaceTime call buttons. */
export function FloatingActionButton({ label, icon, onClick, disabled, primary, active, size = 'md', showLabel }: Props) {
  return (
    <span className="inline-flex flex-col items-center gap-1.5">
      <motion.button
        type="button"
        aria-label={label}
        aria-pressed={active}
        title={label}
        disabled={disabled}
        onClick={onClick}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.93 }}
        className={cx(
          'flex items-center justify-center rounded-full disabled:pointer-events-none disabled:opacity-40',
          size === 'lg' ? 'h-16 w-16' : 'h-12 w-12',
          primary || active ? 'bg-ink text-ink-contrast shadow-glass' : 'glass-strong text-fg',
        )}
      >
        {icon}
      </motion.button>
      {showLabel && <span className="text-xs text-fg-2">{label}</span>}
    </span>
  )
}
