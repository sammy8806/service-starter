import { describe, it, expect } from 'vitest'
import { formatUptime } from './formatUptime'

const NOW = 1_000_000_000_000

describe('formatUptime', () => {
  it('returns an em dash for undefined start time', () => {
    expect(formatUptime(undefined, NOW)).toBe('—')
  })

  it('clamps future/negative durations to 0s', () => {
    expect(formatUptime(NOW + 5000, NOW)).toBe('0s')
  })

  it('formats seconds below a minute', () => {
    expect(formatUptime(NOW - 0, NOW)).toBe('0s')
    expect(formatUptime(NOW - 59_000, NOW)).toBe('59s')
  })

  it('formats whole minutes', () => {
    expect(formatUptime(NOW - 60_000, NOW)).toBe('1m')
    expect(formatUptime(NOW - 59 * 60_000, NOW)).toBe('59m')
  })

  it('formats hours, omitting zero minutes', () => {
    expect(formatUptime(NOW - 60 * 60_000, NOW)).toBe('1h')
    expect(formatUptime(NOW - 90 * 60_000, NOW)).toBe('1h 30m')
  })

  it('formats days, omitting zero hours', () => {
    expect(formatUptime(NOW - 24 * 3_600_000, NOW)).toBe('1d')
    expect(formatUptime(NOW - 28 * 3_600_000, NOW)).toBe('1d 4h')
  })
})
