import { describe, expect, it } from 'vitest'
import { ResolvedProject } from '../config/types'
import { buildPortOwnerMap, matchPortsForComponent, PortOwner } from './port-matcher'

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

describe('port-matcher', () => {
  it('deduplicates repeated owners in the port owner map', () => {
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

    expect(buildPortOwnerMap(projects).get(3000)).toEqual([
      { projectName: 'a', componentName: 'web', label: 'Web' }
    ])
  })

  it('does not mark a port as conflicting when duplicate owners resolve to one component', () => {
    const duplicateOwners: PortOwner[] = [
      { projectName: 'a', componentName: 'web', label: 'Web' },
      { projectName: 'a', componentName: 'web', label: 'Web' }
    ]

    const ports = matchPortsForComponent(
      'a',
      'web',
      [{ port: 3000, label: 'Web' }],
      [{ port: 3000, pid: 1234, process: 'node' }],
      new Map([[3000, duplicateOwners]])
    )

    expect(ports[0]).toMatchObject({ port: 3000, status: 'in-use' })
  })

  it('marks a port as conflicting when distinct components declare it', () => {
    const owners: PortOwner[] = [
      { projectName: 'a', componentName: 'web', label: 'Web' },
      { projectName: 'b', componentName: 'web', label: 'Web' }
    ]

    const ports = matchPortsForComponent(
      'a',
      'web',
      [{ port: 3000, label: 'Web' }],
      [{ port: 3000, pid: 1234, process: 'node' }],
      new Map([[3000, owners]])
    )

    expect(ports[0]).toMatchObject({ port: 3000, status: 'conflict' })
  })
})
