import { cx } from '../utils/format'

interface Option<T extends string> { value: T; label: string; hint?: string }

export function Segmented<T extends string>({ options, value, onChange, ariaLabel, className }: {
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx('grid gap-2', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx('rounded-2xl border px-3 py-2.5 text-start transition', on ? 'border-ink bg-ink text-ink-contrast' : 'border-line glass hover:bg-glass-strong')}
          >
            <span className="block text-sm font-medium">{o.label}</span>
            {o.hint && <span className={cx('mt-0.5 block text-xs', on ? 'opacity-70' : 'text-fg-2')}>{o.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}
