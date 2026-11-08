import { HTMLAttributes } from 'react'
import { cx } from '../utils/format'

export function GlassPanel({ className, strong, ...rest }: HTMLAttributes<HTMLDivElement> & { strong?: boolean }) {
  return <div className={cx(strong ? 'glass-strong' : 'glass', className)} {...rest} />
}
