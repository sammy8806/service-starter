import { describe, it, expect } from 'vitest'
import {
  containerNameMatches,
  findDockerContainer,
  imageMatches,
  normalizeContainerName
} from './docker-matching'
import type { DockerDependency } from '../config/types'

const dep = (container: string, image?: string): DockerDependency => ({
  type: 'docker',
  container,
  image
})

describe('docker-matching', () => {
  it('normalizes leading slashes from docker names', () => {
    expect(normalizeContainerName('/postgres')).toBe('postgres')
  })

  it('matches exact container names', () => {
    expect(containerNameMatches(['/postgres-dev'], 'postgres-dev')).toBe(true)
  })

  it('matches compose-style container names', () => {
    expect(containerNameMatches(['/shop-platform_postgres_1'], 'postgres')).toBe(true)
    expect(containerNameMatches(['/shop-platform-postgres-1'], 'postgres')).toBe(true)
  })

  it('matches containers by image when name match fails', () => {
    const containers = [
      {
        Id: 'abc123',
        Names: ['/shop-platform-db-1'],
        Image: 'postgres:16-alpine',
        State: 'running',
        Status: 'Up 2 hours'
      }
    ]

    const match = findDockerContainer(containers, dep('postgres', 'postgres:16'))
    expect(match?.Id).toBe('abc123')
  })

  it('matches a Compose service within its project directory', () => {
    const containers = [
      {
        Id: 'other',
        Names: ['/other-postgres-1'],
        Image: 'postgres:17',
        State: 'running',
        Status: 'Up 2 hours',
        Labels: {
          'com.docker.compose.service': 'postgres',
          'com.docker.compose.project.working_dir': '/work/other'
        }
      },
      {
        Id: 'shop',
        Names: ['/shop-postgres-1'],
        Image: 'postgres:17',
        State: 'running',
        Status: 'Up 1 hour',
        Labels: {
          'com.docker.compose.service': 'postgres',
          'com.docker.compose.project.working_dir': '/work/shop'
        }
      }
    ]

    const match = findDockerContainer(containers, {
      type: 'docker',
      container: 'postgres',
      composeService: 'postgres',
      composeProjectDir: '/work/shop'
    })

    expect(match?.Id).toBe('shop')
  })

  it('does not match the same Compose service from another project', () => {
    const containers = [
      {
        Id: 'other',
        Names: ['/other-postgres-1'],
        Image: 'postgres:17',
        State: 'running',
        Status: 'Up 2 hours',
        Labels: {
          'com.docker.compose.service': 'postgres',
          'com.docker.compose.project.working_dir': '/work/other'
        }
      }
    ]

    const match = findDockerContainer(containers, {
      type: 'docker',
      container: 'postgres',
      image: 'postgres:17',
      composeService: 'postgres',
      composeProjectDir: '/work/shop'
    })

    expect(match).toBeUndefined()
  })

  it('returns undefined when neither name nor image matches', () => {
    const containers = [
      {
        Id: 'abc123',
        Names: ['/redis'],
        Image: 'redis:7',
        State: 'running',
        Status: 'Up 1 hour'
      }
    ]

    expect(findDockerContainer(containers, dep('postgres'))).toBeUndefined()
  })

  it('matches image references with or without tags', () => {
    expect(imageMatches('postgres:16-alpine', 'postgres')).toBe(true)
    expect(imageMatches('redis@sha256:deadbeef', 'redis')).toBe(true)
  })
})
