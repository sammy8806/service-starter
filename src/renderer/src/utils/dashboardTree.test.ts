import { describe, it, expect } from 'vitest'
import { buildDashboardTree } from './dashboardTree'
import type { AppStateView, ComponentStateView } from '../context/AppContext'

function comp(name: string, over: Partial<ComponentStateView> = {}): ComponentStateView {
  return {
    name,
    status: 'stopped',
    processOrigin: 'none',
    ports: [],
    dependencies: [],
    ...over
  }
}

function state(projects: AppStateView['projects']): AppStateView {
  return { projects, trayIcon: 'grey', conflicts: [], favorites: [], docker: { available: true, containers: [], missing: [] } }
}

describe('buildDashboardTree', () => {
  it('orders projects and components alphabetically', () => {
    const tree = buildDashboardTree(
      state({
        zebra: { name: 'zebra', directory: '/z', dependencies: [], components: { b: comp('b'), a: comp('a') } },
        apple: { name: 'apple', directory: '/a', dependencies: [], components: {} }
      })
    )
    expect(tree.map((p) => p.name)).toEqual(['apple', 'zebra'])
    expect(tree[1].components.map((c) => c.name)).toEqual(['a', 'b'])
  })

  it('counts running components', () => {
    const tree = buildDashboardTree(
      state({
        p: {
          name: 'p',
          directory: '/p',
          dependencies: [],
          components: { a: comp('a', { status: 'running' }), b: comp('b') }
        }
      })
    )
    expect(tree[0].runningCount).toBe(1)
    expect(tree[0].totalCount).toBe(2)
  })

  it('flags conflicts on the component and bubbles to the project', () => {
    const tree = buildDashboardTree(
      state({
        p: {
          name: 'p',
          directory: '/p',
          dependencies: [],
          components: {
            a: comp('a', { ports: [{ port: 3000, label: 'web', status: 'conflict' }] }),
            b: comp('b', { ports: [{ port: 4000, label: 'api', status: 'in-use' }] })
          }
        }
      })
    )
    expect(tree[0].hasConflict).toBe(true)
    expect(tree[0].components.find((c) => c.name === 'a')!.hasConflict).toBe(true)
    expect(tree[0].components.find((c) => c.name === 'b')!.hasConflict).toBe(false)
  })

  it('exposes the first port as the component port hint', () => {
    const tree = buildDashboardTree(
      state({
        p: {
          name: 'p',
          directory: '/p',
          dependencies: [],
          components: { a: comp('a', { ports: [{ port: 8090, label: 'api', status: 'in-use' }] }) }
        }
      })
    )
    expect(tree[0].components[0].primaryPort).toBe(8090)
  })
})
