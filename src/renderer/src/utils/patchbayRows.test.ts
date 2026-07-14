import { describe, expect, it } from 'vitest'
import type { AppStateView, ComponentStateView } from '../context/AppContext'
import { buildPatchbayRows, nextAvailablePort, summarize } from './patchbayRows'

function component(
  name: string,
  status: 'running' | 'stopped',
  port: number,
  label = name,
  portExtra: Partial<ComponentStateView['ports'][number]> = {}
): Record<string, ComponentStateView> {
  return {
    [name]: {
      name,
      status,
      processOrigin: status === 'running' ? 'managed' : 'none',
      dependencies: [],
      ports: [{ port, label, status: 'free', ...portExtra }]
    }
  }
}

const state: AppStateView = {
  trayIcon: 'grey',
  favorites: [],
  conflicts: [],
  docker: { available: true, containers: [], missing: [] },
  projects: {
    bandai: {
      name: 'bandai',
      directory: '/bandai',
      dependencies: [],
      components: component('frontend', 'stopped', 3000)
    },
    auto: {
      name: 'auto',
      directory: '/auto',
      dependencies: [],
      components: component('frontend', 'stopped', 5173)
    },
    fmh: {
      name: 'fmh',
      directory: '/fmh',
      dependencies: [],
      components: component('frontend', 'stopped', 5173)
    }
  }
}

describe('buildPatchbayRows', () => {
  it('sorts by port and marks a single idle claimant', () => {
    const rows = buildPatchbayRows(state)
    expect(rows.map((row) => row.port)).toEqual([3000, 5173])
    expect(rows[0].kind).toBe('idle')
    expect(rows[0].claimants).toHaveLength(1)
  })

  it('groups two claimants on one port as contested', () => {
    const row = buildPatchbayRows(state).find((candidate) => candidate.port === 5173)
    expect(row?.kind).toBe('contested')
    expect(row?.claimants.map((claimant) => claimant.projectName).sort()).toEqual(['auto', 'fmh'])
  })

  it('marks a running single claimant', () => {
    const runningState: AppStateView = {
      ...state,
      projects: {
        bandai: {
          ...state.projects.bandai,
          components: component('frontend', 'running', 3000, 'frontend', {
            status: 'in-use',
            pid: 42,
            process: 'node'
          })
        }
      }
    }
    expect(buildPatchbayRows(runningState)[0].kind).toBe('running')
  })

  it('marks held when a managed claimant owns the active port', () => {
    const heldState: AppStateView = {
      ...state,
      conflicts: [
        {
          port: 8090,
          type: 'runtime',
          claimants: ['bandai/backend', 'fmh/ocr'],
          activePid: 51002,
          activeProcess: 'java'
        }
      ],
      projects: {
        bandai: {
          name: 'bandai',
          directory: '/b',
          dependencies: [],
          components: component('backend', 'running', 8090, 'http', {
            status: 'in-use',
            pid: 51002,
            process: 'java'
          })
        },
        fmh: {
          name: 'fmh',
          directory: '/f',
          dependencies: [],
          components: component('ocr', 'stopped', 8090, 'http')
        }
      }
    }
    const row = buildPatchbayRows(heldState)[0]
    expect(row.kind).toBe('held')
    expect(row.claimants.find((claimant) => claimant.isHolder)?.projectName).toBe('bandai')
  })

  it('flags an external holder when no managed claimant owns the active pid', () => {
    const externalState: AppStateView = {
      ...state,
      conflicts: [
        {
          port: 5173,
          type: 'runtime',
          claimants: ['auto/frontend', 'fmh/frontend'],
          activeProcess: 'vite',
          activePid: 999
        }
      ]
    }
    const row = buildPatchbayRows(externalState).find((candidate) => candidate.port === 5173)
    expect(row?.kind).toBe('held')
    expect(row?.externalHolder).toBe(true)
    expect(row?.holderPid).toBe(999)
  })

  it('does not infer a holder from component status without port process evidence', () => {
    const ambiguousState: AppStateView = {
      ...state,
      projects: {
        auto: {
          ...state.projects.auto,
          components: component('frontend', 'running', 5173)
        },
        fmh: state.projects.fmh
      }
    }
    expect(buildPatchbayRows(ambiguousState)[0].kind).toBe('contested')
  })
})

describe('nextAvailablePort', () => {
  it('returns the lowest undeclared port above the current port', () => {
    const rows = buildPatchbayRows(state)
    expect(nextAvailablePort(rows, 5173)).toBe(5174)
    expect(nextAvailablePort(rows, 3000)).toBe(3001)
  })
})

describe('summarize', () => {
  it('counts services, running, contested and containers up', () => {
    expect(summarize(state)).toEqual({
      services: 3,
      running: 0,
      contested: 1,
      containersUp: 0
    })
  })
})
