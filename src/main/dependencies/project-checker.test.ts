import { describe, it, expect } from 'vitest'
import { checkProjectDependency } from './project-checker'
import { ActivePort, ProjectDependency, ResolvedProject } from '../config/types'

function makeProject(name: string, ports: number[]): ResolvedProject {
  return {
    name,
    directory: `/work/${name}`,
    components: {
      main: {
        ports: ports.map((p) => ({ port: p, label: `Port ${p}` }))
      }
    },
    dependencies: []
  }
}

describe('project-checker', () => {
  it('returns healthy when referenced project has active port', () => {
    const dep: ProjectDependency = { type: 'project', name: 'shared-lib' }
    const projects = new Map<string, ResolvedProject>()
    projects.set('/work/shared-lib', makeProject('shared-lib', [4000]))
    const activePorts: ActivePort[] = [{ port: 4000, pid: 100, process: 'node' }]

    const result = checkProjectDependency(dep, projects, activePorts)
    expect(result.health).toBe('healthy')
  })

  it('returns unhealthy when referenced project has no active ports', () => {
    const dep: ProjectDependency = { type: 'project', name: 'shared-lib' }
    const projects = new Map<string, ResolvedProject>()
    projects.set('/work/shared-lib', makeProject('shared-lib', [4000]))

    const result = checkProjectDependency(dep, projects, [])
    expect(result.health).toBe('unhealthy')
  })

  it('returns unknown when referenced project not found', () => {
    const dep: ProjectDependency = { type: 'project', name: 'missing' }

    const result = checkProjectDependency(dep, new Map(), [])
    expect(result.health).toBe('unknown')
    expect(result.error).toContain('not found')
  })

  it('returns unknown when referenced project has no declared ports', () => {
    const dep: ProjectDependency = { type: 'project', name: 'no-ports' }
    const projects = new Map<string, ResolvedProject>()
    projects.set('/work/no-ports', makeProject('no-ports', []))

    const result = checkProjectDependency(dep, projects, [])
    expect(result.health).toBe('unknown')
    expect(result.error).toContain('no declared ports')
  })
})
