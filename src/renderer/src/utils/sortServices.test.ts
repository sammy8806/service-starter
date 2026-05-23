import { describe, it, expect } from 'vitest'
import { sortServices } from './sortServices'
import {
  AppStateView,
  ComponentStateView,
  ProjectStateView,
  PortStateView
} from '../context/AppContext'

function port(over: Partial<PortStateView> = {}): PortStateView {
  return { port: 3000, label: 'web', status: 'free', ...over }
}

function comp(name: string, over: Partial<ComponentStateView> = {}): ComponentStateView {
  return {
    name,
    status: 'stopped',
    processOrigin: 'none',
    ports: [port()],
    dependencies: [],
    ...over
  }
}

function project(name: string, components: ComponentStateView[]): ProjectStateView {
  return {
    name,
    directory: `/work/${name}`,
    components: Object.fromEntries(components.map((c) => [c.name, c])),
    dependencies: []
  }
}

function appState(projects: ProjectStateView[], conflicts: AppStateView['conflicts'] = []): AppStateView {
  return {
    projects: Object.fromEntries(projects.map((p) => [p.name, p])),
    trayIcon: 'grey',
    conflicts,
    favorites: []
  }
}

describe('sortServices', () => {
  it('places projects with a running component in active, fully-idle in idle', () => {
    const active = project('aaa', [comp('api', { status: 'running' })])
    const idle = project('bbb', [comp('web')])
    const result = sortServices(appState([idle, active]), [])

    expect(result.active.map((p) => p.project.name)).toEqual(['aaa'])
    expect(result.idle.map((p) => p.project.name)).toEqual(['bbb'])
  })

  it('keeps idle siblings inside a partially-running project, running first', () => {
    const p = project('bandai', [
      comp('docs'),
      comp('frontend', { status: 'running' }),
      comp('mobile')
    ])
    const result = sortServices(appState([p]), [])

    expect(result.active).toHaveLength(1)
    const group = result.active[0]
    expect(group.runningCount).toBe(1)
    expect(group.totalCount).toBe(3)
    expect(group.components.map((c) => c.component.name)).toEqual(['frontend', 'docs', 'mobile'])
  })

  it('treats a project with a conflicting (not running) component as active', () => {
    const p = project('zeta', [comp('api', { ports: [port({ status: 'conflict' })] })])
    const result = sortServices(appState([p]), [])
    expect(result.active.map((p) => p.project.name)).toEqual(['zeta'])
    expect(result.idle).toHaveLength(0)
  })

  it('sorts favorites to the top of idle, then alphabetical', () => {
    const a = project('alpha', [comp('x')])
    const z = project('zed', [comp('x')])
    const m = project('mid', [comp('x')])
    const result = sortServices(appState([a, z, m]), ['zed'])
    expect(result.idle.map((p) => p.project.name)).toEqual(['zed', 'alpha', 'mid'])
    expect(result.idle[0].isFavorite).toBe(true)
  })

  it('flattens conflicts from state.conflicts, sorted by primary claimant then port', () => {
    const state = appState(
      [project('p', [comp('x')])],
      [
        { port: 8090, type: 'static', claimants: ['bandai/backend'], activePid: 5 },
        { port: 3001, type: 'static', claimants: ['bandai/docs'], activePid: 6 }
      ]
    )
    const result = sortServices(state, [])
    expect(result.conflicts.map((c) => c.primaryLabel)).toEqual(['bandai/backend', 'bandai/docs'])
  })
})
