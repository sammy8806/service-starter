import { describe, expect, it } from 'vitest'
import { findBoundPort, hasBoundPort, isPortBound } from './port-state'

describe('port-state helpers', () => {
  it('treats in-use ports as bound', () => {
    expect(isPortBound({ status: 'in-use', pid: 1234 })).toBe(true)
  })

  it('treats conflicting ports with a pid as bound', () => {
    const ports = [
      { status: 'free' as const },
      { status: 'conflict' as const, pid: 4321 }
    ]

    expect(hasBoundPort(ports)).toBe(true)
    expect(findBoundPort(ports)).toEqual({ status: 'conflict', pid: 4321 })
  })

  it('keeps unbound static conflicts out of the active state', () => {
    expect(isPortBound({ status: 'conflict' })).toBe(false)
  })
})
