import { describe, it, expect } from 'vitest'
import { buildDockerDependencyState } from './docker-checker'
import type { DockerDependency } from '../config/types'

const dep: DockerDependency = { type: 'docker', container: 'postgres', image: 'postgres:16' }

describe('buildDockerDependencyState', () => {
  it('marks a running container as healthy', () => {
    const result = buildDockerDependencyState(dep, [
      {
        Id: 'abc123def456',
        Names: ['/shop_postgres_1'],
        Image: 'postgres:16-alpine',
        State: 'running',
        Status: 'Up 2 hours'
      }
    ])

    expect(result.health).toBe('healthy')
    expect(result.docker?.state).toBe('running')
    expect(result.docker?.matchedName).toBe('shop_postgres_1')
    expect(result.docker?.statusText).toBe('Up 2 hours')
    expect(result.error).toBeUndefined()
  })

  it('marks a stopped container as unhealthy with state detail', () => {
    const result = buildDockerDependencyState(dep, [
      {
        Id: 'abc123def456',
        Names: ['/postgres'],
        Image: 'postgres:16-alpine',
        State: 'exited',
        Status: 'Exited (1) 5 minutes ago'
      }
    ])

    expect(result.health).toBe('unhealthy')
    expect(result.docker?.state).toBe('stopped')
    expect(result.error).toContain('exited')
  })

  it('marks missing containers as not found', () => {
    const result = buildDockerDependencyState(dep, [])

    expect(result.health).toBe('unhealthy')
    expect(result.docker?.state).toBe('not_found')
    expect(result.error).toContain('not found')
  })
})
