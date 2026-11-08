import { HTMLAttributes } from 'react'
import { cx } from '../utils/format'
import { GlassPanel } from './GlassPanel'

export function GlassCard({ className, interactive, ...rest }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <GlassPanel
      className={cx('rounded-3xl p-5 sm:p-6', interactive && 'transition duration-200 hover:scale-[1.015] hover:bg-glass-strong', className)}
      {...rest}
    />
  )
}
