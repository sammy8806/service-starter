import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ProcessManager } from './process-manager'
import { mkdtempSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import * as childProcess from 'child_process'

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return { ...actual, spawn: vi.fn(actual.spawn) }
})

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

    it('should allow start when declared ports collide but are not bound', async () => {
      const pm = new ProcessManager(async () => [])

      const result = await pm.startComponent({
        projectName: 'test-project',
        componentName: 'frontend',
        startCommand: 'node -e "setInterval(() => {}, 1000)"',
        workDir: tempDir,
        projectDir: tempDir,
        declaredPorts: [3000]
      })

      expect(result.pid).toBeGreaterThan(0)
      pm.stopAll()
    })

    it('should block start when a declared port is currently bound', async () => {
      const pm = new ProcessManager(async () => [{ port: 3000, pid: 4321, process: 'node' }])

      await expect(
        pm.startComponent({
          projectName: 'test-project',
          componentName: 'frontend',
          startCommand: 'node -e "setInterval(() => {}, 1000)"',
          workDir: tempDir,
          projectDir: tempDir,
          declaredPorts: [3000]
        })
      ).rejects.toThrow(
        'Cannot start test-project/frontend; port already bound: :3000 (node pid 4321)'
      )
    })
  })

  describe('stopComponent', () => {
    it('should kill the process and update state', async () => {
      await pm.startComponent({
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

describe('ProcessManager port templating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('substitutes ${port} in the start command and env before spawning', async () => {
    const spawnMock = vi.mocked(childProcess.spawn)
    const projectDir = mkdtempSync(join(tmpdir(), 'pm-template-test-'))
    spawnMock.mockReturnValueOnce({
      pid: 4242,
      unref: () => undefined
    } as unknown as childProcess.ChildProcess)
    const pm = new ProcessManager(async () => [])

    await pm.startComponent({
      projectName: 'p',
      componentName: 'c',
      startCommand: 'vite --port ${port}',
      workDir: projectDir,
      projectDir,
      ports: [{ port: 5174, label: 'frontend' }],
      env: { PORT: '${port}' }
    })

    const [command, args, options] = spawnMock.mock.calls[0]
    expect(command).toBe('vite')
    expect(args).toEqual(['--port', '5174'])
    expect((options as { env: Record<string, string> }).env.PORT).toBe('5174')

    pm.stopAll()
  })

  it('fails closed when a placeholder cannot be resolved', async () => {
    const spawnMock = vi.mocked(childProcess.spawn)
    const pm = new ProcessManager(async () => [])
    const projectDir = mkdtempSync(join(tmpdir(), 'pm-template-test-'))

    await expect(
      pm.startComponent({
        projectName: 'p',
        componentName: 'c',
        startCommand: 'x ${port.missing}',
        workDir: projectDir,
        projectDir,
        ports: [{ port: 1, label: 'frontend' }]
      })
    ).rejects.toThrow(/Unknown port label: missing/)
    expect(spawnMock).not.toHaveBeenCalled()
  })
})
