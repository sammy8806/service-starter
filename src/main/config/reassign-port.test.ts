import { describe, expect, it } from 'vitest'
import { reassignPort, type ReassignDeps } from './reassign-port'
import type { CentralConfig, ResolvedProject } from './types'

function makeDeps(
  over: Partial<ReassignDeps> = {},
  config?: CentralConfig
): { deps: ReassignDeps; saved: CentralConfig[] } {
  const saved: CentralConfig[] = []
  const project: ResolvedProject = {
    name: 'bandai',
    directory: '/bandai',
    dependencies: [],
    components: {
      backend: {
        startCommand: 'boot --server.port=${port}',
        ports: [
          { port: 8090, label: 'http' },
          { port: 9090, label: 'admin' }
        ]
      }
    }
  }
  const baseConfig: CentralConfig = config ?? {
    scanDirectories: [],
    scanIntervalMs: 0,
    portScanIntervalMs: 0,
    editor: '',
    terminal: '',
    gitGui: ''
  }
  const deps: ReassignDeps = {
    getProjects: () => new Map([['/bandai', project]]),
    getConfig: () => baseConfig,
    applyConfig: (next) => saved.push(next),
    isPortActive: () => false,
    isManagedRunning: () => false,
    ...over
  }
  return { deps, saved }
}

describe('reassignPort', () => {
  it('writes the complete port list as an override, preserving siblings', () => {
    const { deps, saved } = makeDeps()

    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8091)).toEqual({ ok: true })
    expect(saved).toHaveLength(1)
    expect(saved[0].overrides?.bandai.components?.backend.ports).toEqual([
      { port: 8091, label: 'http' },
      { port: 9090, label: 'admin' }
    ])
  })

  it('preserves existing sibling component and project overrides', () => {
    const config: CentralConfig = {
      scanDirectories: [],
      scanIntervalMs: 0,
      portScanIntervalMs: 0,
      editor: '',
      terminal: '',
      gitGui: '',
      overrides: {
        bandai: { components: { frontend: { ports: [{ port: 3001, label: 'http' }] } } },
        other: { components: { worker: { ports: [{ port: 4001, label: 'metrics' }] } } }
      }
    }
    const { deps, saved } = makeDeps({}, config)

    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8091)).toEqual({ ok: true })
    expect(saved[0].overrides?.bandai.components?.frontend).toEqual(
      config.overrides?.bandai.components?.frontend
    )
    expect(saved[0].overrides?.other).toEqual(config.overrides?.other)
  })

  it('rejects an unknown project, component, or label', () => {
    const { deps } = makeDeps()

    expect(reassignPort(deps, 'nope', 'backend', 'http', 8090, 8091).code).toBe('project-not-found')
    expect(reassignPort(deps, 'bandai', 'nope', 'http', 8090, 8091).code).toBe(
      'component-not-found'
    )
    expect(reassignPort(deps, 'bandai', 'backend', 'nope', 8090, 8091).code).toBe(
      'declaration-not-found'
    )
  })

  it('rejects a stale fromPort', () => {
    const { deps } = makeDeps()
    expect(reassignPort(deps, 'bandai', 'backend', 'http', 9999, 8091).code).toBe(
      'stale-declaration'
    )
  })

  it('rejects invalid destinations', () => {
    const { deps } = makeDeps()
    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8090).code).toBe(
      'invalid-destination'
    )
    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 70000).code).toBe(
      'invalid-destination'
    )
    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 9090).code).toBe(
      'invalid-destination'
    )
  })

  it('rejects an occupied destination and suggests the next free port', () => {
    const { deps } = makeDeps({ isPortActive: (port) => port === 8091 })
    const result = reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8091)

    expect(result.code).toBe('destination-occupied')
    expect(result.suggestedPort).toBe(8092)
  })

  it('rejects a destination declared by another component', () => {
    const { deps, saved } = makeDeps({
      getProjects: () =>
        new Map([
          [
            '/bandai',
            {
              name: 'bandai',
              directory: '/bandai',
              dependencies: [],
              components: {
                backend: {
                  startCommand: 'boot --server.port=${port}',
                  ports: [{ port: 8090, label: 'http' }]
                },
                frontend: { ports: [{ port: 8091, label: 'http' }] }
              }
            }
          ]
        ])
    })

    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8091).code).toBe(
      'destination-occupied'
    )
    expect(saved).toHaveLength(0)
  })

  it('rejects when the component is currently running', () => {
    const { deps } = makeDeps({ isManagedRunning: () => true })
    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8091).code).toBe('active-holder')
  })

  it('rejects when the declaration is not wired into the command or env', () => {
    const { deps } = makeDeps({
      getProjects: () =>
        new Map([
          [
            '/bandai',
            {
              name: 'bandai',
              directory: '/bandai',
              dependencies: [],
              components: {
                backend: { startCommand: 'boot', ports: [{ port: 8090, label: 'http' }] }
              }
            }
          ]
        ])
    })

    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8091).code).toBe(
      'missing-template'
    )
  })

  it('accepts a declaration wired through env', () => {
    const { deps, saved } = makeDeps({
      getProjects: () =>
        new Map([
          [
            '/bandai',
            {
              name: 'bandai',
              directory: '/bandai',
              dependencies: [],
              components: {
                backend: {
                  startCommand: 'boot',
                  env: { PORT: '${port}' },
                  ports: [{ port: 8090, label: 'http' }]
                }
              }
            }
          ]
        ])
    })

    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8091)).toEqual({ ok: true })
    expect(saved).toHaveLength(1)
  })

  it('reports persistence failure without mutating the source config', () => {
    const config: CentralConfig = {
      scanDirectories: [],
      scanIntervalMs: 0,
      portScanIntervalMs: 0,
      editor: '',
      terminal: '',
      gitGui: ''
    }
    const { deps, saved } = makeDeps(
      {
        applyConfig: () => {
          throw new Error('disk full')
        }
      },
      config
    )

    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8091).code).toBe('persist-failed')
    expect(config.overrides).toBeUndefined()
    expect(saved).toHaveLength(0)
  })
})
