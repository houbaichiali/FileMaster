import { clamp, formatBytes, formatTime, parseTime } from '../utils/format'

describe('format helpers', () => {
  it('formats bytes', () => {
    expect(formatBytes(0, 'en')).toBe('0 B')
    expect(formatBytes(1536, 'en')).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024, 'en')).toBe('5 MB')
    expect(formatBytes(-1)).toBe('—')
  })
  it('formats and parses times symmetrically', () => {
    expect(formatTime(83.5)).toBe('1:23.500')
    expect(formatTime(3725)).toBe('1:02:05.000')
    for (const s of [0, 0.25, 5, 83.5, 3600.125]) expect(parseTime(formatTime(s))).toBeCloseTo(s, 3)
  })
  it('parses user input leniently but rejects garbage', () => {
    expect(parseTime('83.5')).toBe(83.5)
    expect(parseTime('1:23,5')).toBe(83.5)
    expect(parseTime('1:02:05')).toBe(3725)
    for (const bad of ['', 'abc', '1:2:3:4', '-5', '1:xx']) expect(parseTime(bad)).toBeNull()
  })
  it('clamps', () => { expect(clamp(5, 0, 3)).toBe(3); expect(clamp(-1, 0, 3)).toBe(0) })
})
