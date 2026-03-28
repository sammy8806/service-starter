import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProcessManager } from './process-manager'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('ProcessManager', () => {
  let tempDir: string
  let pm: ProcessManager

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'pm-test-'))
    pm = new ProcessManager()
  })

  afterEach(() => {
    pm.stopAll()
  })

  describe('startComponent', () => {
    it('should spawn a detached process and track it', async () => {
      const result = await pm.startComponent({
        projectName: 'test-project',
        componentName: 'frontend',
        startCommand: 'node -e "setInterval(() => {}, 1000)"',
        workDir: tempDir,
        projectDir: tempDir
      })

      expect(result.pid).toBeGreaterThan(0)
      expect(result.logFile).toContain('.service-starter/logs/frontend.log')

      const tracked = pm.getManagedProcess('test-project', 'frontend')
      expect(tracked).toBeDefined()
      expect(tracked!.pid).toBe(result.pid)
    })

    it('should create log directory and file', async () => {
      await pm.startComponent({
        projectName: 'test-project',
        componentName: 'backend',
        startCommand: 'echo "hello"',
        workDir: tempDir,
        projectDir: tempDir
      })

      const logDir = join(tempDir, '.service-starter', 'logs')
      expect(existsSync(logDir)).toBe(true)
    })

    it('should write state file after spawn', async () => {
      await pm.startComponent({
        projectName: 'test-project',
        componentName: 'api',
        startCommand: 'node -e "setInterval(() => {}, 1000)"',
        workDir: tempDir,
        projectDir: tempDir
      })

      const stateFile = join(tempDir, '.service-starter', 'state.json')
      expect(existsSync(stateFile)).toBe(true)

      const state = JSON.parse(readFileSync(stateFile, 'utf-8'))
      expect(state.processes.api).toBeDefined()
      expect(state.processes.api.pid).toBeGreaterThan(0)
    })
  })

  describe('stopComponent', () => {
    it('should kill the process and update state', async () => {
      const result = await pm.startComponent({
        projectName: 'test-project',
        componentName: 'frontend',
        startCommand: 'node -e "setInterval(() => {}, 1000)"',
        workDir: tempDir,
        projectDir: tempDir
      })

      const stopped = await pm.stopComponent('test-project', 'frontend')
      expect(stopped).toBe(true)

      const tracked = pm.getManagedProcess('test-project', 'frontend')
      expect(tracked).toBeUndefined()
    })
  })

  describe('isProcessAlive', () => {
    it('should return true for a running process', async () => {
      const result = await pm.startComponent({
        projectName: 'test-project',
        componentName: 'frontend',
        startCommand: 'node -e "setInterval(() => {}, 1000)"',
        workDir: tempDir,
        projectDir: tempDir
      })

      expect(pm.isProcessAlive(result.pid)).toBe(true)
    })

    it('should return false for a non-existent PID', () => {
      expect(pm.isProcessAlive(999999)).toBe(false)
    })
  })

  describe('reconnect', () => {
    it('should load state from disk and validate PIDs', async () => {
      // Start a process so state file exists
      await pm.startComponent({
        projectName: 'test-project',
        componentName: 'frontend',
        startCommand: 'node -e "setInterval(() => {}, 1000)"',
        workDir: tempDir,
        projectDir: tempDir
      })

      // Create a new ProcessManager and reconnect
      const pm2 = new ProcessManager()
      pm2.reconnect(tempDir)

      const tracked = pm2.getManagedProcess('test-project', 'frontend')
      expect(tracked).toBeDefined()
    })
  })
})
