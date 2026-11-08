import { Kind } from '../services/api'
import { useFileSession } from './useFileSession'

/** The session file, if the current tool accepts its kind. */
export function useToolFile(accept: Kind[]) {
  const { file, setFile } = useFileSession()
  return { file: file && accept.includes(file.kind) ? file : null, setFile }
}
