import { describe, it, expect } from 'vitest'
import {
  collectDockerDependencies,
  dependencyStatusLabel,
  dependencyStatusTone
} from './dependencyDisplay'
import type { DependencyStateView } from '../context/AppContext'

const dockerDep = (container: string, state: NonNullable<DependencyStateView['docker']>['state']): DependencyStateView => ({
  dependency: { type: 'docker', container },
  health: state === 'running' ? 'healthy' : state === 'unavailable' ? 'unknown' : 'unhealthy',
  lastChecked: Date.now(),
  docker: { state, statusText: state === 'running' ? 'Up 2 hours' : undefined },
  error: state === 'not_found' ? 'Container "postgres" not found' : undefined
})

describe('dependencyDisplay', () => {
  it('labels docker container states explicitly', () => {
    expect(dependencyStatusLabel(dockerDep('postgres', 'running'))).toBe('Running')
    expect(dependencyStatusLabel(dockerDep('postgres', 'not_found'))).toBe('Not found')
    expect(dependencyStatusLabel(dockerDep('postgres', 'unavailable'))).toBe('Docker unavailable')
  })

  it('treats missing containers as warning tone', () => {
    expect(dependencyStatusTone(dockerDep('postgres', 'not_found'))).toBe('warning')
  })

  it('collects unique docker dependencies across projects', () => {
    const rows = collectDockerDependencies({
      projects: {
        shop: {
          name: 'shop',
          dependencies: [dockerDep('postgres', 'running')],
          components: {
            api: { dependencies: [dockerDep('redis', 'stopped')] }
          }
        }
      }
    })

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.container)).toEqual(['postgres', 'redis'])
  })
})
