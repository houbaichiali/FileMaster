import ar from '../locales/ar/translation.json'
import en from '../locales/en/translation.json'
import fr from '../locales/fr/translation.json'

type Tree = { [k: string]: string | Tree }
const flat = (o: Tree, p = ''): Record<string, string> =>
  Object.entries(o).reduce((acc, [k, v]) => (typeof v === 'string' ? { ...acc, [p + k]: v } : { ...acc, ...flat(v, `${p}${k}.`) }), {})
const L = { fr: flat(fr as Tree), en: flat(en as Tree), ar: flat(ar as Tree) }
const placeholders = (s: string) => (s.match(/{{\w+}}/g) ?? []).sort().join(',')

describe('translations', () => {
  it('have exactly the same keys in fr, en and ar', () => {
    const keys = Object.keys(L.en).sort()
    expect(Object.keys(L.fr).sort()).toEqual(keys)
    expect(Object.keys(L.ar).sort()).toEqual(keys)
  })
  it('have no empty values', () => {
    for (const lang of Object.values(L)) for (const v of Object.values(lang)) expect(v.trim()).not.toBe('')
  })
  it('use the same interpolation placeholders in every language', () => {
    for (const k of Object.keys(L.en)) {
      expect(placeholders(L.fr[k])).toBe(placeholders(L.en[k]))
      expect(placeholders(L.ar[k])).toBe(placeholders(L.en[k]))
    }
  })
  it('Arabic values are really Arabic (no copied English), apart from product names', () => {
    const allowed = new Set(['app.name', 'language.fr', 'language.en', 'details.crf'])
    for (const [k, v] of Object.entries(L.ar)) if (!allowed.has(k)) expect(v).toMatch(/[\u0600-\u06FF]/)
  })
})
