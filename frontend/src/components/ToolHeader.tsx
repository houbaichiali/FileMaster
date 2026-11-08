import { ReactNode } from 'react'

export function ToolHeader({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <span className="glass-strong flex h-14 w-14 shrink-0 items-center justify-center rounded-full">{icon}</span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-2">{description}</p>}
      </div>
    </div>
  )
}
