import { describe, it, expect } from 'vitest'
import { detectConflicts } from './conflict-detector'
import { ActivePort, ResolvedProject } from '../config/types'

function makeProject(
  name: string,
  components: Record<string, { ports: { port: number; label: string }[] }>
): ResolvedProject {
  const comps: ResolvedProject['components'] = {}
  for (const [compName, comp] of Object.entries(components)) {
    comps[compName] = { ports: comp.ports }
  }
  return { name, directory: `/work/${name}`, components: comps, dependencies: [] }
}

describe('conflict-detector', () => {
  it('returns no conflicts when ports are unique', () => {
    const projects = new Map<string, ResolvedProject>()
    projects.set('/work/a', makeProject('a', { web: { ports: [{ port: 3000, label: 'Web' }] } }))
    projects.set('/work/b', makeProject('b', { api: { ports: [{ port: 4000, label: 'API' }] } }))

    const conflicts = detectConflicts(projects, [])
    expect(conflicts).toEqual([])
  })

  it('detects static conflicts (same port declared twice)', () => {
    const projects = new Map<string, ResolvedProject>()
    projects.set('/work/a', makeProject('a', { web: { ports: [{ port: 3000, label: 'Web A' }] } }))
    projects.set('/work/b', makeProject('b', { web: { ports: [{ port: 3000, label: 'Web B' }] } }))

    const conflicts = detectConflicts(projects, [])

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].port).toBe(3000)
    expect(conflicts[0].type).toBe('static')
    expect(conflicts[0].claimants).toEqual(['a/web', 'b/web'])
  })

  it('includes active process info in static conflict', () => {
    const projects = new Map<string, ResolvedProject>()
    projects.set('/work/a', makeProject('a', { web: { ports: [{ port: 3000, label: 'Web' }] } }))
    projects.set('/work/b', makeProject('b', { web: { ports: [{ port: 3000, label: 'Web' }] } }))

    const activePorts: ActivePort[] = [{ port: 3000, pid: 1234, process: 'node' }]

    const conflicts = detectConflicts(projects, activePorts)

    expect(conflicts[0].activeProcess).toBe('node')
    expect(conflicts[0].activePid).toBe(1234)
  })

  it('detects static conflict within same project', () => {
    const projects = new Map<string, ResolvedProject>()
    projects.set(
      '/work/a',
      makeProject('a', {
        web: { ports: [{ port: 3000, label: 'Web' }] },
        api: { ports: [{ port: 3000, label: 'API' }] }
      })
    )

    const conflicts = detectConflicts(projects, [])

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].claimants).toEqual(['a/web', 'a/api'])
  })

  it('deduplicates repeated declarations from the same project component', () => {
    const projects = new Map<string, ResolvedProject>()
    projects.set(
      '/work/a',
      makeProject('a', {
        web: {
          ports: [
            { port: 3000, label: 'Web' },
            { port: 3000, label: 'Web' }
          ]
        },
        docs: { ports: [{ port: 3000, label: 'Docs' }] }
      })
    )

    const conflicts = detectConflicts(projects, [])

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].claimants).toEqual(['a/web', 'a/docs'])
  })

  it('does not report a conflict for duplicate declarations from only one component', () => {
    const projects = new Map<string, ResolvedProject>()
    projects.set(
      '/work/a',
      makeProject('a', {
        web: {
          ports: [
            { port: 3000, label: 'Web' },
            { port: 3000, label: 'Web' }
          ]
        }
      })
    )

    const conflicts = detectConflicts(projects, [{ port: 3000, pid: 1234, process: 'node' }])

    expect(conflicts).toEqual([])
  })

  it('deduplicates repeated discoveries of the same project component', () => {
    const projects = new Map<string, ResolvedProject>()
    projects.set(
      '/work/a',
      makeProject('bandai', { frontend: { ports: [{ port: 3000, label: 'Web' }] } })
    )
    projects.set(
      '/work/a-copy',
      makeProject('bandai', { frontend: { ports: [{ port: 3000, label: 'Web' }] } })
    )
    projects.set(
      '/work/a-docs',
      makeProject('bandai', { docs: { ports: [{ port: 3000, label: 'Docs' }] } })
    )

    const conflicts = detectConflicts(projects, [])

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].claimants).toEqual(['bandai/frontend', 'bandai/docs'])
  })

  it('returns empty for no projects', () => {
    const conflicts = detectConflicts(new Map(), [])
    expect(conflicts).toEqual([])
  })
})
