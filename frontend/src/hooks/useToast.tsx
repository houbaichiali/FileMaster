import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

interface Toast { id: number; message: string }
const ToastContext = createContext<{ notify: (message: string) => void }>({ notify: () => undefined })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const notify = useCallback((message: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])
  const value = useMemo(() => ({ notify }), [notify])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="glass-strong pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-fg">
            <CheckCircle2 size={18} aria-hidden /> {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
