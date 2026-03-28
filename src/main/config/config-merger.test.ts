import { describe, it, expect } from 'vitest'
import { mergeConfig } from './config-merger'
import { CentralConfig, ProjectManifest } from './types'

function makeCentralConfig(overrides?: CentralConfig['overrides']): CentralConfig {
  return {
    scanDirectories: ['~/work'],
    scanIntervalMs: 5000,
    portScanIntervalMs: 3000,
    editor: 'code',
    terminal: 'default',
    overrides
  }
}

function makeManifest(partial?: Partial<ProjectManifest>): ProjectManifest {
  return {
    name: 'test-project',
    components: {
      api: {
        ports: [{ port: 3000, label: 'API' }],
        workDir: './api'
      }
    },
    ...partial
  }
}

describe('config-merger', () => {
  it('returns resolved project without overrides', () => {
    const manifest = makeManifest()
    const config = makeCentralConfig()

    const result = mergeConfig(manifest, '/home/user/work/test-project', config)

    expect(result.name).toBe('test-project')
    expect(result.directory).toBe('/home/user/work/test-project')
    expect(result.components['api'].ports).toEqual([{ port: 3000, label: 'API' }])
  })

  it('applies port overrides from central config', () => {
    const manifest = makeManifest()
    const config = makeCentralConfig({
      'test-project': {
        components: {
          api: {
            ports: [{ port: 9080, label: 'Custom API' }]
          }
        }
      }
    })

    const result = mergeConfig(manifest, '/home/user/work/test-project', config)

    expect(result.components['api'].ports).toEqual([{ port: 9080, label: 'Custom API' }])
  })

  it('preserves component fields not overridden', () => {
    const manifest = makeManifest()
    const config = makeCentralConfig({
      'test-project': {
        components: {
          api: {
            ports: [{ port: 9080, label: 'Custom' }]
          }
        }
      }
    })

    const result = mergeConfig(manifest, '/home/user/work/test-project', config)

    expect(result.components['api'].workDir).toBe('./api')
  })

  it('does not affect components without overrides', () => {
    const manifest = makeManifest({
      components: {
        api: { ports: [{ port: 3000, label: 'API' }] },
        web: { ports: [{ port: 8080, label: 'Web' }] }
      }
    })
    const config = makeCentralConfig({
      'test-project': {
        components: {
          api: { ports: [{ port: 9080, label: 'Custom' }] }
        }
      }
    })

    const result = mergeConfig(manifest, '/path', config)

    expect(result.components['api'].ports[0].port).toBe(9080)
    expect(result.components['web'].ports[0].port).toBe(8080)
  })

  it('collects project-level dependencies', () => {
    const manifest = makeManifest({
      dependencies: [{ type: 'project', name: 'shared-lib' }]
    })

    const result = mergeConfig(manifest, '/path', makeCentralConfig())

    expect(result.dependencies).toEqual([{ type: 'project', name: 'shared-lib' }])
  })

  it('handles manifests with no overrides key in central config', () => {
    const manifest = makeManifest()
    const config = makeCentralConfig(undefined)

    const result = mergeConfig(manifest, '/path', config)
    expect(result.components['api'].ports).toEqual([{ port: 3000, label: 'API' }])
  })
})
