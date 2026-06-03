import { describe, it, expect } from 'vitest'
import { computeKpis } from './dashboardStats'
import type { AppStateView } from '../context/AppContext'

function state(over: Partial<AppStateView> = {}): AppStateView {
  return { projects: {}, trayIcon: 'grey', conflicts: [], favorites: [], ...over }
}

describe('computeKpis', () => {
  it('returns zeros for empty state', () => {
    expect(computeKpis(state())).toEqual({ running: 0, totalPorts: 0, activePorts: 0, conflicts: 0 })
  })

  it('counts running components, ports, active ports, and conflicts', () => {
    const s = state({
      conflicts: [{ port: 3000, type: 'static', claimants: ['a/web', 'b/web'] }],
      projects: {
        p: {
          name: 'p',
          directory: '/p',
          dependencies: [],
          components: {
            web: {
              name: 'web',
              status: 'running',
              processOrigin: 'managed',
              dependencies: [],
              ports: [
                { port: 3000, label: 'web', status: 'in-use' },
                { port: 9229, label: 'debug', status: 'free' }
              ]
            }
          }
        }
      }
    })
    expect(computeKpis(s)).toEqual({ running: 1, totalPorts: 2, activePorts: 1, conflicts: 1 })
  })

  it('counts a conflict port as active', () => {
    const s = state({
      projects: {
        p: {
          name: 'p', directory: '/p', dependencies: [],
          components: {
            web: {
              name: 'web', status: 'stopped', processOrigin: 'none',
              dependencies: [],
              ports: [{ port: 3000, label: 'web', status: 'conflict' }]
            }
          }
        }
      }
    })
    expect(computeKpis(s)).toEqual({ running: 0, totalPorts: 1, activePorts: 1, conflicts: 0 })
  })
})
