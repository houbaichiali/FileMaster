import { createContext, ReactNode, useContext, useMemo, useState } from 'react'
import { FileMeta } from '../services/api'

interface Session {
  file: FileMeta | null
  setFile: (f: FileMeta | null) => void
}
const Ctx = createContext<Session>({ file: null, setFile: () => undefined })

/** Holds the file currently being worked on so the dashboard can hand it to a tool. */
export function FileSessionProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<FileMeta | null>(null)
  const value = useMemo(() => ({ file, setFile }), [file])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useFileSession = () => useContext(Ctx)
