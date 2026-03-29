import { describe, expect, it } from 'vitest'
import { deriveComponentRuntimeState } from './component-runtime'

describe('deriveComponentRuntimeState', () => {
  it('keeps managed services running when their bound port is also in conflict', () => {
    expect(
      deriveComponentRuntimeState({
        portStates: [{ status: 'conflict', pid: 4321 }],
        dependencies: [],
        isManaged: true
      })
    ).toEqual({
      status: 'running',
      processOrigin: 'managed'
    })
  })

  it('does not mark ambiguous static-conflict claimants as externally running', () => {
    expect(
      deriveComponentRuntimeState({
        portStates: [{ status: 'conflict', pid: 4321 }],
        dependencies: [],
        isManaged: false
      })
    ).toEqual({
      status: 'warning',
      processOrigin: 'none'
    })
  })

  it('marks observed in-use ports as external running', () => {
    expect(
      deriveComponentRuntimeState({
        portStates: [{ status: 'in-use', pid: 1234 }],
        dependencies: [],
        isManaged: false
      })
    ).toEqual({
      status: 'running',
      processOrigin: 'external'
    })
  })
})
