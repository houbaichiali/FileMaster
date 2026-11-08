import { createStore, useStore } from '../utils/store'

export interface Settings {
  preciseCut: boolean
}
const store = createStore<Settings>('fm-settings', { preciseCut: true }, (raw) => ({
  preciseCut: typeof (raw as Settings)?.preciseCut === 'boolean' ? (raw as Settings).preciseCut : true,
}))

export function useSettings() {
  const settings = useStore(store)
  return { settings, update: (patch: Partial<Settings>) => store.set({ ...settings, ...patch }) }
}
