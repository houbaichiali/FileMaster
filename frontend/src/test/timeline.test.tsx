import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import '../i18n'
import { Timeline } from '../features/Timeline'

describe('Timeline', () => {
  it('moves the trim handles with the keyboard and stays within bounds', () => {
    const onRange = vi.fn()
    render(<Timeline duration={10} start={2} end={8} current={0} zoom={1} onRange={onRange} onSeek={vi.fn()} />)
    const [startH, endH] = screen.getAllByRole('slider')
    expect(startH).toHaveAttribute('aria-valuenow', '2')
    fireEvent.keyDown(startH, { key: 'ArrowRight', shiftKey: true })
    expect(onRange).toHaveBeenLastCalledWith(3, 8)
    fireEvent.keyDown(endH, { key: 'ArrowLeft' })
    expect(onRange).toHaveBeenLastCalledWith(2, expect.closeTo(7.9, 5))
    fireEvent.keyDown(startH, { key: 'ArrowLeft', shiftKey: true }); fireEvent.keyDown(startH, { key: 'ArrowLeft', shiftKey: true })
    expect(onRange.mock.calls.every(([s]) => s >= 0)).toBe(true)
  })
  it('is always laid out left-to-right, even on an RTL page', () => {
    document.documentElement.dir = 'rtl'
    render(<Timeline duration={10} start={0} end={10} current={0} zoom={1} onRange={vi.fn()} onSeek={vi.fn()} />)
    expect(screen.getByTestId('timeline')).toHaveAttribute('dir', 'ltr')
    document.documentElement.dir = 'ltr'
  })
})
