import { beforeEach, describe, it, expect, vi } from 'vitest'
import { collectDeclaredDockerRefs, buildDockerSnapshot } from './docker-snapshot'
import type { ResolvedProject } from '../config/types'

vi.mock('./docker-checker', () => ({
  listDockerContainers: vi.fn(),
  resetDockerClient: vi.fn()
}))

import { listDockerContainers } from './docker-checker'

function project(
  name: string,
  dockerDeps: Array<{ container: string; image?: string; scope: string }>
): ResolvedProject {
  const projectDeps = dockerDeps
    .filter((d) => d.scope === 'project')
    .map((d) => ({
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
  beforeEach(() => {
    vi.mocked(listDockerContainers).mockRejectedValue(new Error('Docker unavailable'))
  })

  it('collects declared docker refs with used-by labels', () => {
    const projects = new Map<string, ResolvedProject>([
      ['/work/shop', project('shop', [{ container: 'postgres', scope: 'project' }])]
    ])

    expect(collectDeclaredDockerRefs(projects)).toEqual([
      {
        container: 'postgres',
        image: undefined,
        composeService: undefined,
        composeFile: undefined,
        composeProjectDir: undefined,
        usedBy: ['shop']
      }
    ])
  })

  it('reports declared refs when Docker is unavailable', async () => {
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

  it('attributes same-named Compose services to the correct projects', async () => {
    vi.mocked(listDockerContainers).mockResolvedValue([
      {
        Id: 'shop-postgres',
        Names: ['/shop-postgres-1'],
        Image: 'postgres:17',
        State: 'running',
        Status: 'Up 1 hour',
        Labels: {
          'com.docker.compose.service': 'postgres',
          'com.docker.compose.project.working_dir': '/work/shop'
        }
      },
      {
        Id: 'blog-postgres',
        Names: ['/blog-postgres-1'],
        Image: 'postgres:17',
        State: 'running',
        Status: 'Up 2 hours',
        Labels: {
          'com.docker.compose.service': 'postgres',
          'com.docker.compose.project.working_dir': '/work/blog'
        }
      }
    ])

    const composeProject = (name: string): ResolvedProject => ({
      name,
      directory: `/work/${name}`,
      dependencies: [],
      components: {
        api: {
          ports: [],
          dependencies: [
            {
              type: 'docker',
              container: 'postgres',
              composeService: 'postgres',
              composeProjectDir: `/work/${name}`
            }
          ]
        }
      }
    })
    const projects = new Map([
      ['/work/shop', composeProject('shop')],
      ['/work/blog', composeProject('blog')]
    ])

    const snapshot = await buildDockerSnapshot(projects)

    expect(
      snapshot.containers.find((container) => container.name === 'shop-postgres-1')?.usedBy
    ).toEqual(['shop/api'])
    expect(
      snapshot.containers.find((container) => container.name === 'blog-postgres-1')?.usedBy
    ).toEqual(['blog/api'])
  })
})
