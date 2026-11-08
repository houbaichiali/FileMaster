import { ReactNode, useId } from 'react'

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children(id)}
      {hint && <p className="hint mt-1.5">{hint}</p>}
    </div>
  )
}
