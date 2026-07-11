import { describe, it, expect } from 'vitest'
import { collectDeclaredDockerRefs, buildDockerSnapshot } from './docker-snapshot'
import type { ResolvedProject } from '../config/types'

function project(name: string, dockerDeps: Array<{ container: string; image?: string; scope: string }>): ResolvedProject {
  const projectDeps = dockerDeps.filter((d) => d.scope === 'project').map((d) => ({
    type: 'docker' as const,
    container: d.container,
    image: d.image
  }))
  const componentDeps = dockerDeps.filter((d) => d.scope !== 'project')

  return {
    name,
    directory: `/work/${name}`,
    dependencies: projectDeps,
    components: {
      api: {
        ports: [],
        dependencies: componentDeps.map((d) => ({
          type: 'docker' as const,
          container: d.container,
          image: d.image
        }))
      }
    }
  }
}

describe('docker-snapshot', () => {
  it('collects declared docker refs with used-by labels', () => {
    const projects = new Map<string, ResolvedProject>([
      ['/work/shop', project('shop', [{ container: 'postgres', scope: 'project' }])]
    ])

    expect(collectDeclaredDockerRefs(projects)).toEqual([
      { container: 'postgres', image: undefined, usedBy: ['shop'] }
    ])
  })

  it('maps live docker containers and missing manifest refs', async () => {
    const projects = new Map<string, ResolvedProject>([
      [
        '/work/shop',
        project('shop', [
          { container: 'postgres', scope: 'project' },
          { container: 'clickhouse', scope: 'api' }
        ])
      ]
    ])

    const snapshot = await buildDockerSnapshot(projects)
    expect(snapshot.available).toBe(false)
    expect(snapshot.containers).toEqual([])
    expect(snapshot.missing.map((m) => m.ref)).toEqual(['clickhouse', 'postgres'])
  })
})
