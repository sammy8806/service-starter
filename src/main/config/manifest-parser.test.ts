import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseManifest, manifestExists } from './manifest-parser'

describe('manifest-parser', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ss-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  function writeManifest(content: string): void {
    writeFileSync(join(tempDir, '.service-starter.yml'), content, 'utf-8')
  }

  describe('manifestExists', () => {
    it('returns false when no manifest', () => {
      expect(manifestExists(tempDir)).toBe(false)
    })

    it('returns true when manifest exists', () => {
      writeManifest('name: test')
      expect(manifestExists(tempDir)).toBe(true)
    })
  })

  describe('parseManifest', () => {
    it('parses a valid full manifest', () => {
      writeManifest(`
name: my-project
components:
  api:
    workDir: ./api
    codeDir: ./api/src
    startCommand: npm start
    ports:
      - port: 3000
        label: API Server
    env:
      NODE_ENV: development
      API_KEY: \${MY_KEY}
    dependencies:
      - type: docker
        container: redis-dev
      - type: service
        name: tailscale
        check: tailscale status
dependencies:
  - type: project
    name: shared-lib
`)

      const { manifest } = parseManifest(tempDir)

      expect(manifest).not.toBeNull()
      expect(manifest!.name).toBe('my-project')
      expect(Object.keys(manifest!.components)).toEqual(['api'])

      const api = manifest!.components['api']
      expect(api.workDir).toBe('./api')
      expect(api.codeDir).toBe('./api/src')
      expect(api.startCommand).toBe('npm start')
      expect(api.ports).toEqual([{ port: 3000, label: 'API Server' }])
      expect(api.env).toEqual({ NODE_ENV: 'development', API_KEY: '${MY_KEY}' })
      expect(api.dependencies).toHaveLength(2)
      expect(api.dependencies![0]).toEqual({ type: 'docker', container: 'redis-dev' })
      expect(api.dependencies![1]).toEqual({
        type: 'service',
        name: 'tailscale',
        check: 'tailscale status'
      })

      expect(manifest!.dependencies).toHaveLength(1)
      expect(manifest!.dependencies![0]).toEqual({ type: 'project', name: 'shared-lib' })
    })

    it('resolves Docker metadata from a default Compose file', () => {
      writeFileSync(
        join(tempDir, 'docker-compose.yml'),
        `
services:
  postgres:
    image: postgres:17-alpine
    container_name: shop-postgres
`,
        'utf-8'
      )
      writeManifest(`
name: shop
components:
  api:
    ports: []
    dependencies:
      - type: docker
        composeService: postgres
`)

      const { manifest, errors } = parseManifest(tempDir)

      expect(errors).toEqual([])
      expect(manifest!.components['api'].dependencies![0]).toEqual({
        type: 'docker',
        container: 'shop-postgres',
        image: 'postgres:17-alpine',
        composeService: 'postgres',
        composeFile: 'docker-compose.yml',
        composeProjectDir: tempDir
      })
    })

    it('uses the Compose service name when container_name is not set', () => {
      writeFileSync(
        join(tempDir, 'compose.yaml'),
        `
services:
  redis:
    image: redis:7-alpine
`,
        'utf-8'
      )
      writeManifest(`
name: shop
components:
  api:
    ports: []
    dependencies:
      - type: docker
        composeService: redis
`)

      const { manifest } = parseManifest(tempDir)

      expect(manifest!.components['api'].dependencies![0]).toMatchObject({
        container: 'redis',
        image: 'redis:7-alpine',
        composeService: 'redis'
      })
    })

    it('supports an explicit Compose file', () => {
      writeFileSync(
        join(tempDir, 'compose.dev.yml'),
        `
services:
  database:
    image: postgres:16
`,
        'utf-8'
      )
      writeManifest(`
name: shop
components:
  api:
    ports: []
    dependencies:
      - type: docker
        composeService: database
        composeFile: compose.dev.yml
`)

      const { manifest, errors } = parseManifest(tempDir)

      expect(errors).toEqual([])
      expect(manifest!.components['api'].dependencies![0]).toMatchObject({
        container: 'database',
        image: 'postgres:16',
        composeService: 'database',
        composeFile: 'compose.dev.yml'
      })
    })

    it('reports a missing Compose service', () => {
      writeFileSync(join(tempDir, 'compose.yml'), 'services: {}\n', 'utf-8')
      writeManifest(`
name: shop
components:
  api:
    ports: []
    dependencies:
      - type: docker
        composeService: postgres
`)

      const { manifest, errors } = parseManifest(tempDir)

      expect(errors).toContain(
        'Docker dependency: Compose service "postgres" not found in compose.yml'
      )
      expect(manifest!.components['api'].dependencies).toBeUndefined()
    })

    it('handles minimal manifest with just name and components', () => {
      writeManifest(`
name: minimal
components:
  web:
    ports:
      - port: 8080
        label: Web
`)

      const { manifest } = parseManifest(tempDir)
      expect(manifest).not.toBeNull()
      expect(manifest!.name).toBe('minimal')
      expect(manifest!.components['web'].ports).toEqual([{ port: 8080, label: 'Web' }])
    })

    it('parses a short-lived command without ports', () => {
      writeManifest(`
name: billing
components:
  migrate:
    type: command
    command: npm run db:migrate
    workDir: ./api
`)

      const { manifest, errors } = parseManifest(tempDir)

      expect(errors).toEqual([])
      expect(manifest!.components.migrate).toMatchObject({
        type: 'command',
        command: 'npm run db:migrate',
        workDir: './api',
        ports: []
      })
    })

    it('uses directory name as fallback when name is missing', () => {
      writeManifest(`
components:
  web:
    ports: []
`)

      const { manifest, errors } = parseManifest(tempDir)
      expect(manifest).not.toBeNull()
      // Name should be the basename of tempDir
      expect(manifest!.name).toBe(tempDir.split('/').pop())
      expect(errors).toContain('Missing "name" field, using directory name as fallback')
    })

    it('reports errors for invalid YAML', () => {
      writeManifest('{{invalid yaml}')

      const { errors } = parseManifest(tempDir)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toMatch(/Invalid YAML/)
    })

    it('reports errors for missing manifest', () => {
      const { manifest, errors } = parseManifest(tempDir)
      expect(manifest).toBeNull()
      expect(errors).toContain('Manifest file not found')
    })

    it('reports errors for unknown dependency types', () => {
      writeManifest(`
name: test
components:
  web:
    ports: []
    dependencies:
      - type: unknown-thing
        name: foo
`)

      const { errors } = parseManifest(tempDir)
      expect(errors).toContain('Unknown dependency type: "unknown-thing"')
    })

    it('parses api dependency with envRequired', () => {
      writeManifest(`
name: test
components:
  web:
    ports: []
    dependencies:
      - type: api
        name: anthropic
        check: curl -sf https://api.anthropic.com
        envRequired:
          - ANTHROPIC_API_KEY
`)

      const { manifest } = parseManifest(tempDir)
      const dep = manifest!.components['web'].dependencies![0]
      expect(dep).toEqual({
        type: 'api',
        name: 'anthropic',
        check: 'curl -sf https://api.anthropic.com',
        envRequired: ['ANTHROPIC_API_KEY']
      })
    })

    it('defaults port label when not provided', () => {
      writeManifest(`
name: test
components:
  web:
    ports:
      - port: 3000
`)

      const { manifest } = parseManifest(tempDir)
      expect(manifest!.components['web'].ports[0]).toEqual({
        port: 3000,
        label: 'Port 3000'
      })
    })
  })
})
