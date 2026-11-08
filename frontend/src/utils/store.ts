import { useSyncExternalStore } from 'react'

/** Tiny localStorage-backed store usable with useSyncExternalStore. */
export function createStore<T>(key: string, initial: T, parse?: (raw: unknown) => T) {
  const listeners = new Set<() => void>()
  let cache: T = initial
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) {
      const value = JSON.parse(raw)
      cache = parse ? parse(value) : (value as T)
    }
  } catch {
    cache = initial
  }
  return {
    get: () => cache,
    set(next: T) {
      cache = next
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* storage unavailable: keep in memory */
      }
      listeners.forEach((l) => l())
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

export function useStore<T>(store: ReturnType<typeof createStore<T>>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}
