import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { scanDirectories, listAllProjectDirs } from './project-scanner'

describe('project-scanner', () => {
  let scanDir: string

  beforeEach(() => {
    scanDir = mkdtempSync(join(tmpdir(), 'ss-scan-'))
  })

  afterEach(() => {
    rmSync(scanDir, { recursive: true, force: true })
  })

  function createProject(name: string, manifest?: string): string {
    const dir = join(scanDir, name)
    mkdirSync(dir, { recursive: true })
    if (manifest) {
      writeFileSync(join(dir, '.service-starter.yml'), manifest, 'utf-8')
    }
    return dir
  }

  describe('scanDirectories', () => {
    it('discovers projects with manifests', () => {
      createProject('project-a', 'name: project-a\ncomponents:\n  web:\n    ports:\n      - port: 3000\n        label: Web')
      createProject('project-b') // No manifest

      const results = scanDirectories([scanDir])

      expect(results).toHaveLength(1)
      expect(results[0].directory).toBe(join(scanDir, 'project-a'))
      expect(results[0].parseResult.manifest!.name).toBe('project-a')
    })

    it('returns empty array for empty scan dir', () => {
      const results = scanDirectories([scanDir])
      expect(results).toHaveLength(0)
    })

    it('skips hidden directories', () => {
      createProject('.hidden-project', 'name: hidden\ncomponents:\n  web:\n    ports: []')

      const results = scanDirectories([scanDir])
      expect(results).toHaveLength(0)
    })

    it('handles non-existent scan directories gracefully', () => {
      const results = scanDirectories(['/nonexistent/path'])
      expect(results).toHaveLength(0)
    })

    it('scans multiple directories', () => {
      const scanDir2 = mkdtempSync(join(tmpdir(), 'ss-scan2-'))
      createProject('proj1', 'name: proj1\ncomponents:\n  web:\n    ports: []')

      const dir2proj = join(scanDir2, 'proj2')
      mkdirSync(dir2proj)
      writeFileSync(
        join(dir2proj, '.service-starter.yml'),
        'name: proj2\ncomponents:\n  api:\n    ports: []',
        'utf-8'
      )

      const results = scanDirectories([scanDir, scanDir2])
      expect(results).toHaveLength(2)

      rmSync(scanDir2, { recursive: true, force: true })
    })
  })

  describe('listAllProjectDirs', () => {
    it('lists all subdirectories', () => {
      createProject('project-a', 'name: a\ncomponents:\n  web:\n    ports: []')
      createProject('project-b') // no manifest

      const dirs = listAllProjectDirs([scanDir])
      expect(dirs).toHaveLength(2)
      expect(dirs).toContain(join(scanDir, 'project-a'))
      expect(dirs).toContain(join(scanDir, 'project-b'))
    })

    it('skips hidden directories', () => {
      createProject('.hidden')
      createProject('visible')

      const dirs = listAllProjectDirs([scanDir])
      expect(dirs).toHaveLength(1)
      expect(dirs[0]).toBe(join(scanDir, 'visible'))
    })
  })
})
