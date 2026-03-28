# Start/Stop Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the ability to start, stop, and view logs for service components from within Service Starter, with detached process management and colocated log files.

**Architecture:** Two new modules — `ProcessManager` (spawn/track/stop detached processes, persist PIDs) and `LogStreamer` (tail log files, stream to renderer via IPC). Both follow the existing EventEmitter pattern. State flows through the existing `buildAppState()` → `pushStateToRenderers()` pipeline. UI distinguishes managed processes (started by Service Starter) from external ones (detected via port scan).

**Tech Stack:** Node.js `child_process.spawn`, `fs.watch`, Electron IPC, React, Tailwind CSS, Vitest

---

## File Structure

**New files:**
- `src/main/process/types.ts` — ManagedProcess interface and ProcessStatus type
- `src/main/process/process-manager.ts` — Spawn, track, stop, reconnect detached processes
- `src/main/process/process-manager.test.ts` — Unit tests for ProcessManager
- `src/main/process/log-streamer.ts` — Tail and stream log file content via IPC
- `src/main/process/log-streamer.test.ts` — Unit tests for LogStreamer

**Modified files:**
- `src/main/config/types.ts` — Add `ProcessStatus` to `ComponentState`, add `ManagedProcess` type
- `src/main/ipc/channels.ts` — Add process and log IPC channels
- `src/main/ipc/handlers.ts` — Register new IPC handlers for start/stop/logs
- `src/main/index.ts` — Initialize ProcessManager and LogStreamer, wire events, update `buildAppState()`
- `src/preload/index.ts` — Expose new API methods to renderer
- `src/preload/index.d.ts` — Type declarations for new API methods
- `src/renderer/src/context/AppContext.tsx` — Add `processStatus` to `ComponentStateView`, add action methods
- `src/renderer/src/components/ComponentRow.tsx` — Add start/stop button
- `src/renderer/src/components/dashboard/ProjectsTab.tsx` — Add start/stop all, log viewer panel

---

### Task 1: Process Types

**Files:**
- Create: `src/main/process/types.ts`
- Modify: `src/main/config/types.ts`

- [ ] **Step 1: Create the process types file**

```typescript
// src/main/process/types.ts

export type ProcessStatus = 'managed-running' | 'external-running' | 'stopped' | 'crashed'

export interface ManagedProcess {
  projectName: string
  componentName: string
  pid: number
  startedAt: string // ISO timestamp
  startCommand: string
  workDir: string
  logFile: string
}

export interface ProcessStateFile {
  processes: Record<string, ManagedProcess> // key: componentName
}
```

- [ ] **Step 2: Add processStatus to ComponentState in types.ts**

In `src/main/config/types.ts`, add the import and update `ComponentState`:

```typescript
// Add to the ComponentStatus type (line 96):
// Change:
export type ComponentStatus = 'running' | 'stopped' | 'warning'
// To:
export type ComponentStatus = 'running' | 'stopped' | 'warning'
export type ProcessOrigin = 'managed' | 'external' | 'none'
```

Add `processOrigin` to `ComponentState`:

```typescript
export interface ComponentState {
  name: string
  status: ComponentStatus
  processOrigin: ProcessOrigin
  ports: PortState[]
  dependencies: DependencyState[]
  editor?: string
  codeDir?: string
  workDir?: string
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main/process/types.ts src/main/config/types.ts
git commit -m "feat: add process management types"
```

---

### Task 2: ProcessManager Core

**Files:**
- Create: `src/main/process/process-manager.test.ts`
- Create: `src/main/process/process-manager.ts`

- [ ] **Step 1: Write failing tests for ProcessManager**

```typescript
// src/main/process/process-manager.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/process/process-manager.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ProcessManager**

```typescript
// src/main/process/process-manager.ts
import { EventEmitter } from 'events'
import { spawn } from 'child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync, openSync, closeSync } from 'fs'
import { join } from 'path'
import { ManagedProcess, ProcessStateFile } from './types'

interface StartComponentOptions {
  projectName: string
  componentName: string
  startCommand: string
  workDir: string
  projectDir: string
  env?: Record<string, string>
}

interface StartResult {
  pid: number
  logFile: string
}

/**
 * Manages spawning, tracking, and stopping detached processes.
 * Persists PIDs to .service-starter/state.json per project.
 */
export class ProcessManager extends EventEmitter {
  // key: "projectName:componentName" -> ManagedProcess
  private processes = new Map<string, ManagedProcess>()
  // key: "projectName:componentName" -> projectDir (for state file writes)
  private projectDirs = new Map<string, string>()

  private key(projectName: string, componentName: string): string {
    return `${projectName}:${componentName}`
  }

  getManagedProcess(projectName: string, componentName: string): ManagedProcess | undefined {
    return this.processes.get(this.key(projectName, componentName))
  }

  getManagedProcesses(): Map<string, ManagedProcess> {
    return new Map(this.processes)
  }

  isManagedRunning(projectName: string, componentName: string): boolean {
    const proc = this.processes.get(this.key(projectName, componentName))
    if (!proc) return false
    return this.isProcessAlive(proc.pid)
  }

  isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }

  async startComponent(opts: StartComponentOptions): Promise<StartResult> {
    const k = this.key(opts.projectName, opts.componentName)

    // Stop existing if running
    if (this.processes.has(k)) {
      await this.stopComponent(opts.projectName, opts.componentName)
    }

    // Ensure log directory
    const logDir = join(opts.projectDir, '.service-starter', 'logs')
    mkdirSync(logDir, { recursive: true })

    const logFile = join(logDir, `${opts.componentName}.log`)

    // Open log file for writing (truncate)
    const logFd = openSync(logFile, 'w')

    // Parse command
    const parts = opts.startCommand.split(/\s+/)
    const cmd = parts[0]
    const args = parts.slice(1)

    // Merge env
    const env = { ...process.env, ...opts.env }

    // Spawn detached
    const child = spawn(cmd, args, {
      cwd: opts.workDir,
      env,
      detached: true,
      stdio: ['ignore', logFd, logFd]
    })

    child.unref()
    closeSync(logFd)

    const managed: ManagedProcess = {
      projectName: opts.projectName,
      componentName: opts.componentName,
      pid: child.pid!,
      startedAt: new Date().toISOString(),
      startCommand: opts.startCommand,
      workDir: opts.workDir,
      logFile
    }

    this.processes.set(k, managed)
    this.projectDirs.set(k, opts.projectDir)

    // Persist state
    this.writeStateFile(opts.projectDir)

    this.emit('process-started', managed)

    return { pid: managed.pid, logFile }
  }

  async stopComponent(projectName: string, componentName: string): Promise<boolean> {
    const k = this.key(projectName, componentName)
    const managed = this.processes.get(k)
    if (!managed) return false

    const projectDir = this.projectDirs.get(k)

    // Try SIGTERM to process group
    try {
      process.kill(-managed.pid, 'SIGTERM')
    } catch {
      // Process group kill failed, try individual
      try {
        process.kill(managed.pid, 'SIGTERM')
      } catch {
        // Already dead
      }
    }

    // Wait up to 5 seconds for graceful shutdown
    const dead = await this.waitForDeath(managed.pid, 5000)
    if (!dead) {
      try {
        process.kill(-managed.pid, 'SIGKILL')
      } catch {
        try {
          process.kill(managed.pid, 'SIGKILL')
        } catch {
          // Already dead
        }
      }
    }

    this.processes.delete(k)
    this.projectDirs.delete(k)

    if (projectDir) {
      this.writeStateFile(projectDir)
    }

    this.emit('process-stopped', managed)
    return true
  }

  async stopProject(projectName: string): Promise<void> {
    const toStop: string[] = []
    for (const [k, proc] of this.processes) {
      if (proc.projectName === projectName) {
        toStop.push(proc.componentName)
      }
    }
    await Promise.all(toStop.map((comp) => this.stopComponent(projectName, comp)))
  }

  stopAll(): void {
    for (const [k, proc] of this.processes) {
      try {
        process.kill(-proc.pid, 'SIGTERM')
      } catch {
        try {
          process.kill(proc.pid, 'SIGTERM')
        } catch {
          // Already dead
        }
      }
    }
    this.processes.clear()
    this.projectDirs.clear()
  }

  /**
   * Reconnect to previously managed processes from a project directory.
   * Reads .service-starter/state.json and validates PIDs.
   */
  reconnect(projectDir: string): void {
    const stateFile = join(projectDir, '.service-starter', 'state.json')
    if (!existsSync(stateFile)) return

    try {
      const raw = readFileSync(stateFile, 'utf-8')
      const state: ProcessStateFile = JSON.parse(raw)

      for (const [compName, managed] of Object.entries(state.processes)) {
        if (this.isProcessAlive(managed.pid)) {
          const k = this.key(managed.projectName, managed.componentName)
          this.processes.set(k, managed)
          this.projectDirs.set(k, projectDir)
        }
      }
    } catch {
      // Corrupt state file, ignore
    }
  }

  private async waitForDeath(pid: number, timeoutMs: number): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (!this.isProcessAlive(pid)) return true
      await new Promise((r) => setTimeout(r, 100))
    }
    return !this.isProcessAlive(pid)
  }

  private writeStateFile(projectDir: string): void {
    const stateDir = join(projectDir, '.service-starter')
    mkdirSync(stateDir, { recursive: true })

    const stateFile = join(stateDir, 'state.json')
    const state: ProcessStateFile = { processes: {} }

    for (const [k, proc] of this.processes) {
      const dir = this.projectDirs.get(k)
      if (dir === projectDir) {
        state.processes[proc.componentName] = proc
      }
    }

    writeFileSync(stateFile, JSON.stringify(state, null, 2))
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/process/process-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/process/process-manager.ts src/main/process/process-manager.test.ts
git commit -m "feat: add ProcessManager with spawn, stop, and reconnect"
```

---

### Task 3: LogStreamer

**Files:**
- Create: `src/main/process/log-streamer.test.ts`
- Create: `src/main/process/log-streamer.ts`

- [ ] **Step 1: Write failing tests for LogStreamer**

```typescript
// src/main/process/log-streamer.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LogStreamer } from './log-streamer'
import { mkdtempSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('LogStreamer', () => {
  let tempDir: string
  let streamer: LogStreamer

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'log-test-'))
    streamer = new LogStreamer()
  })

  afterEach(() => {
    streamer.stopAll()
  })

  describe('getLog', () => {
    it('should return file contents', () => {
      const logFile = join(tempDir, 'test.log')
      writeFileSync(logFile, 'line 1\nline 2\n')

      const content = streamer.getLog(logFile)
      expect(content).toBe('line 1\nline 2\n')
    })

    it('should return empty string for non-existent file', () => {
      const content = streamer.getLog(join(tempDir, 'nope.log'))
      expect(content).toBe('')
    })
  })

  describe('startTailing', () => {
    it('should emit new data when file is appended to', async () => {
      const logFile = join(tempDir, 'tail.log')
      writeFileSync(logFile, 'initial\n')

      const chunks: string[] = []
      streamer.on('log-data', (data: { logFile: string; content: string }) => {
        chunks.push(data.content)
      })

      streamer.startTailing(logFile)

      // Wait for watcher to initialize
      await new Promise((r) => setTimeout(r, 200))

      appendFileSync(logFile, 'new line\n')

      // Wait for fs.watch to fire
      await new Promise((r) => setTimeout(r, 500))

      expect(chunks.length).toBeGreaterThanOrEqual(1)
      expect(chunks.join('')).toContain('new line')
    })
  })

  describe('stopTailing', () => {
    it('should stop watching the file', () => {
      const logFile = join(tempDir, 'stop.log')
      writeFileSync(logFile, '')

      streamer.startTailing(logFile)
      streamer.stopTailing(logFile)

      // Should not throw
      expect(true).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/process/log-streamer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement LogStreamer**

```typescript
// src/main/process/log-streamer.ts
import { EventEmitter } from 'events'
import { readFileSync, existsSync, watch, statSync, FSWatcher } from 'fs'

interface TailState {
  watcher: FSWatcher
  offset: number
  logFile: string
}

/**
 * Reads and tails log files, emitting new content for streaming to renderer.
 * Separate from ProcessManager — only reads files, doesn't manage processes.
 */
export class LogStreamer extends EventEmitter {
  private tails = new Map<string, TailState>()

  getLog(logFile: string): string {
    if (!existsSync(logFile)) return ''
    try {
      return readFileSync(logFile, 'utf-8')
    } catch {
      return ''
    }
  }

  startTailing(logFile: string): void {
    // Stop existing tail on same file
    this.stopTailing(logFile)

    if (!existsSync(logFile)) return

    const stat = statSync(logFile)
    const offset = stat.size

    const watcher = watch(logFile, () => {
      this.readNewContent(logFile)
    })

    this.tails.set(logFile, { watcher, offset, logFile })
  }

  stopTailing(logFile: string): void {
    const tail = this.tails.get(logFile)
    if (tail) {
      tail.watcher.close()
      this.tails.delete(logFile)
    }
  }

  stopAll(): void {
    for (const [file, tail] of this.tails) {
      tail.watcher.close()
    }
    this.tails.clear()
  }

  private readNewContent(logFile: string): void {
    const tail = this.tails.get(logFile)
    if (!tail) return

    try {
      const stat = statSync(logFile)
      if (stat.size <= tail.offset) {
        // File was truncated (new run), reset offset
        if (stat.size < tail.offset) {
          tail.offset = 0
        } else {
          return
        }
      }

      const fd = require('fs').openSync(logFile, 'r')
      const buf = Buffer.alloc(stat.size - tail.offset)
      require('fs').readSync(fd, buf, 0, buf.length, tail.offset)
      require('fs').closeSync(fd)

      tail.offset = stat.size

      const content = buf.toString('utf-8')
      if (content.length > 0) {
        this.emit('log-data', { logFile, content })
      }
    } catch {
      // File might be gone, ignore
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/process/log-streamer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/process/log-streamer.ts src/main/process/log-streamer.test.ts
git commit -m "feat: add LogStreamer for tailing log files"
```

---

### Task 4: IPC Channels and Handlers

**Files:**
- Modify: `src/main/ipc/channels.ts`
- Modify: `src/main/ipc/handlers.ts`

- [ ] **Step 1: Add new IPC channels**

In `src/main/ipc/channels.ts`, add to the `IPC_CHANNELS` object:

```typescript
export const IPC_CHANNELS = {
  // ... existing channels ...

  // Process management
  START_COMPONENT: 'process:start-component',
  STOP_COMPONENT: 'process:stop-component',
  START_PROJECT: 'process:start-project',
  STOP_PROJECT: 'process:stop-project',

  // Log streaming
  LOG_GET: 'log:get',
  LOG_START_TAIL: 'log:start-tail',
  LOG_STOP_TAIL: 'log:stop-tail',
  LOG_DATA: 'log:data'
} as const
```

- [ ] **Step 2: Add handler dependencies and registration**

In `src/main/ipc/handlers.ts`, extend `HandlerDependencies`:

```typescript
interface HandlerDependencies {
  // ... existing deps ...
  startComponent: (projectName: string, componentName: string) => Promise<{ pid: number; logFile: string }>
  stopComponent: (projectName: string, componentName: string) => Promise<boolean>
  startProject: (projectName: string) => Promise<void>
  stopProject: (projectName: string) => Promise<void>
  getLog: (projectName: string, componentName: string) => string
  startLogTail: (projectName: string, componentName: string) => void
  stopLogTail: (projectName: string, componentName: string) => void
}
```

Add new handler registrations inside `registerIpcHandlers`:

```typescript
  ipcMain.handle(IPC_CHANNELS.START_COMPONENT, async (_event, projectName: string, componentName: string) => {
    return deps.startComponent(projectName, componentName)
  })

  ipcMain.handle(IPC_CHANNELS.STOP_COMPONENT, async (_event, projectName: string, componentName: string) => {
    return deps.stopComponent(projectName, componentName)
  })

  ipcMain.handle(IPC_CHANNELS.START_PROJECT, async (_event, projectName: string) => {
    await deps.startProject(projectName)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.STOP_PROJECT, async (_event, projectName: string) => {
    await deps.stopProject(projectName)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.LOG_GET, (_event, projectName: string, componentName: string) => {
    return deps.getLog(projectName, componentName)
  })

  ipcMain.on(IPC_CHANNELS.LOG_START_TAIL, (_event, projectName: string, componentName: string) => {
    deps.startLogTail(projectName, componentName)
  })

  ipcMain.on(IPC_CHANNELS.LOG_STOP_TAIL, (_event, projectName: string, componentName: string) => {
    deps.stopLogTail(projectName, componentName)
  })
```

- [ ] **Step 3: Add log data push function**

Add a new export in `src/main/ipc/handlers.ts`:

```typescript
export function pushLogDataToRenderers(logFile: string, content: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.LOG_DATA, { logFile, content })
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/channels.ts src/main/ipc/handlers.ts
git commit -m "feat: add IPC channels and handlers for process management and log streaming"
```

---

### Task 5: Preload API

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

- [ ] **Step 1: Add new methods to preload API**

In `src/preload/index.ts`, add to the `api` object:

```typescript
  // Process management
  startComponent: (projectName: string, componentName: string) =>
    ipcRenderer.invoke('process:start-component', projectName, componentName),
  stopComponent: (projectName: string, componentName: string) =>
    ipcRenderer.invoke('process:stop-component', projectName, componentName),
  startProject: (projectName: string) =>
    ipcRenderer.invoke('process:start-project', projectName),
  stopProject: (projectName: string) =>
    ipcRenderer.invoke('process:stop-project', projectName),

  // Log streaming
  getLog: (projectName: string, componentName: string) =>
    ipcRenderer.invoke('log:get', projectName, componentName),
  startLogTail: (projectName: string, componentName: string) =>
    ipcRenderer.send('log:start-tail', projectName, componentName),
  stopLogTail: (projectName: string, componentName: string) =>
    ipcRenderer.send('log:stop-tail', projectName, componentName),
  onLogData: (callback: (data: { logFile: string; content: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { logFile: string; content: string }): void =>
      callback(data)
    ipcRenderer.on('log:data', handler)
    return () => ipcRenderer.removeListener('log:data', handler)
  }
```

- [ ] **Step 2: Update type declarations**

In `src/preload/index.d.ts`, add to `ServiceStarterAPI`:

```typescript
  startComponent: (projectName: string, componentName: string) => Promise<{ pid: number; logFile: string }>
  stopComponent: (projectName: string, componentName: string) => Promise<boolean>
  startProject: (projectName: string) => Promise<boolean>
  stopProject: (projectName: string) => Promise<boolean>
  getLog: (projectName: string, componentName: string) => Promise<string>
  startLogTail: (projectName: string, componentName: string) => void
  stopLogTail: (projectName: string, componentName: string) => void
  onLogData: (callback: (data: { logFile: string; content: string }) => void) => () => void
```

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: expose process management and log streaming in preload API"
```

---

### Task 6: Wire Up Main Process

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Import new modules**

Add imports at the top of `src/main/index.ts`:

```typescript
import { ProcessManager } from './process/process-manager'
import { LogStreamer } from './process/log-streamer'
import { pushLogDataToRenderers } from './ipc/handlers'
import { ProcessOrigin } from './config/types'
```

Add module variables after the existing ones:

```typescript
let processManager: ProcessManager
let logStreamer: LogStreamer
```

- [ ] **Step 2: Update buildAppState to include processOrigin**

In the `buildAppState()` function, update the component status logic to distinguish managed vs external:

Replace the component status calculation block (inside the `for (const [compName, comp] of Object.entries(project.components))` loop):

```typescript
      const hasActivePorts = portStates.some((p) => p.status === 'in-use')
      const hasIssue = portStates.some((p) => p.status === 'conflict') ||
                       depStates.some((d) => d.health === 'unhealthy')
      const isManaged = processManager.isManagedRunning(project.name, compName)

      let processOrigin: ProcessOrigin = 'none'
      if (isManaged) {
        processOrigin = 'managed'
      } else if (hasActivePorts) {
        processOrigin = 'external'
      }

      components[compName] = {
        name: compName,
        status: hasIssue ? 'warning' : hasActivePorts ? 'running' : 'stopped',
        processOrigin,
        ports: portStates,
        dependencies: depStates,
        editor: comp.editor,
        codeDir: comp.codeDir ? join(dir, comp.codeDir) : undefined,
        workDir: comp.workDir ? join(dir, comp.workDir) : undefined
      }
```

- [ ] **Step 3: Initialize ProcessManager and LogStreamer in app.whenReady**

After `healthAggregator = new HealthAggregator(10000)`, add:

```typescript
  processManager = new ProcessManager()
  logStreamer = new LogStreamer()
```

- [ ] **Step 4: Add reconnection after projectRegistry.start()**

After `projectRegistry.start()`, add:

```typescript
  // Reconnect to previously managed processes
  for (const [dir, _project] of projectRegistry.getProjects()) {
    processManager.reconnect(dir)
  }
```

- [ ] **Step 5: Wire ProcessManager and LogStreamer events**

After the existing event wiring, add:

```typescript
  processManager.on('process-started', pushState)
  processManager.on('process-stopped', pushState)

  logStreamer.on('log-data', ({ logFile, content }: { logFile: string; content: string }) => {
    pushLogDataToRenderers(logFile, content)
  })
```

- [ ] **Step 6: Add new handler dependencies**

Add these to the `registerIpcHandlers({...})` call:

```typescript
    startComponent: async (projectName: string, componentName: string) => {
      // Find the project and component config
      for (const [dir, project] of projectRegistry.getProjects()) {
        if (project.name === projectName) {
          const comp = project.components[componentName]
          if (comp && comp.startCommand) {
            return processManager.startComponent({
              projectName,
              componentName,
              startCommand: comp.startCommand,
              workDir: comp.workDir ? join(dir, comp.workDir) : dir,
              projectDir: dir,
              env: comp.env
            })
          }
        }
      }
      throw new Error(`Component ${projectName}/${componentName} not found or has no startCommand`)
    },
    stopComponent: (projectName: string, componentName: string) =>
      processManager.stopComponent(projectName, componentName),
    startProject: async (projectName: string) => {
      for (const [dir, project] of projectRegistry.getProjects()) {
        if (project.name === projectName) {
          const starts = Object.entries(project.components)
            .filter(([_, comp]) => comp.startCommand)
            .map(([compName, comp]) =>
              processManager.startComponent({
                projectName,
                componentName: compName,
                startCommand: comp.startCommand!,
                workDir: comp.workDir ? join(dir, comp.workDir) : dir,
                projectDir: dir,
                env: comp.env
              })
            )
          await Promise.all(starts)
          return
        }
      }
    },
    stopProject: (projectName: string) => processManager.stopProject(projectName),
    getLog: (projectName: string, componentName: string) => {
      for (const [dir, project] of projectRegistry.getProjects()) {
        if (project.name === projectName) {
          const logFile = join(dir, '.service-starter', 'logs', `${componentName}.log`)
          return logStreamer.getLog(logFile)
        }
      }
      return ''
    },
    startLogTail: (projectName: string, componentName: string) => {
      for (const [dir, project] of projectRegistry.getProjects()) {
        if (project.name === projectName) {
          const logFile = join(dir, '.service-starter', 'logs', `${componentName}.log`)
          logStreamer.startTailing(logFile)
          return
        }
      }
    },
    stopLogTail: (projectName: string, componentName: string) => {
      for (const [dir, project] of projectRegistry.getProjects()) {
        if (project.name === projectName) {
          const logFile = join(dir, '.service-starter', 'logs', `${componentName}.log`)
          logStreamer.stopTailing(logFile)
          return
        }
      }
    }
```

- [ ] **Step 7: Add cleanup in before-quit handler**

In the `app.on('before-quit', ...)` handler, add:

```typescript
  logStreamer?.stopAll()
  // Note: don't call processManager.stopAll() — processes are detached and should survive
```

- [ ] **Step 8: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: wire ProcessManager and LogStreamer into main process orchestrator"
```

---

### Task 7: Renderer State and Context

**Files:**
- Modify: `src/renderer/src/context/AppContext.tsx`

- [ ] **Step 1: Add processOrigin to ComponentStateView**

Add to the `ComponentStateView` interface:

```typescript
export interface ComponentStateView {
  name: string
  status: 'running' | 'stopped' | 'warning'
  processOrigin: 'managed' | 'external' | 'none'
  ports: PortStateView[]
  dependencies: DependencyStateView[]
  editor?: string
  codeDir?: string
  workDir?: string
}
```

- [ ] **Step 2: Add process actions to AppContextType**

```typescript
interface AppContextType {
  state: AppStateView
  openTerminal: (workDir: string) => void
  openEditor: (codeDir: string, editor?: string) => void
  openGitGui: (dir: string) => void
  killPort: (port: number) => Promise<boolean>
  openDashboard: () => void
  startComponent: (projectName: string, componentName: string) => Promise<unknown>
  stopComponent: (projectName: string, componentName: string) => Promise<boolean>
  startProject: (projectName: string) => Promise<unknown>
  stopProject: (projectName: string) => Promise<unknown>
}
```

- [ ] **Step 3: Add default values and implementation**

Update the `createContext` defaults:

```typescript
const AppContext = createContext<AppContextType>({
  state: DEFAULT_STATE,
  openTerminal: () => {},
  openEditor: () => {},
  openGitGui: () => {},
  killPort: async () => false,
  openDashboard: () => {},
  startComponent: async () => {},
  stopComponent: async () => false,
  startProject: async () => {},
  stopProject: async () => {}
})
```

Update the `value` object in `AppProvider`:

```typescript
  const value: AppContextType = {
    state,
    openTerminal: (workDir) => window.api.openTerminal(workDir),
    openEditor: (codeDir, editor) => window.api.openEditor(codeDir, editor),
    openGitGui: (dir) => window.api.openGitGui(dir),
    killPort: (port) => window.api.killPort(port),
    openDashboard: () => window.api.openDashboard(),
    startComponent: (projectName, componentName) => window.api.startComponent(projectName, componentName),
    stopComponent: (projectName, componentName) => window.api.stopComponent(projectName, componentName),
    startProject: (projectName) => window.api.startProject(projectName),
    stopProject: (projectName) => window.api.stopProject(projectName)
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/context/AppContext.tsx
git commit -m "feat: add process management actions to React context"
```

---

### Task 8: Tray ComponentRow Start/Stop Button

**Files:**
- Modify: `src/renderer/src/components/ComponentRow.tsx`

- [ ] **Step 1: Add start/stop props and button**

Update `ComponentRowProps`:

```typescript
interface ComponentRowProps {
  component: ComponentStateView
  projectName: string
  projectDir: string
  onOpenEditor: (dir: string, editor?: string) => void
  onKillPort: (port: number) => void
  onStartComponent: (projectName: string, componentName: string) => void
  onStopComponent: (projectName: string, componentName: string) => void
}
```

Update the function signature to destructure the new props:

```typescript
export function ComponentRow({
  component,
  projectName,
  projectDir,
  onOpenEditor,
  onKillPort,
  onStartComponent,
  onStopComponent
}: ComponentRowProps): React.JSX.Element {
```

Add a start/stop button in the hover actions div, before the editor button:

```typescript
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {component.status === 'stopped' ? (
          <ActionButton
            icon="play"
            title="Start"
            onClick={() => onStartComponent(projectName, component.name)}
          />
        ) : component.processOrigin === 'managed' ? (
          <ActionButton
            icon="stop"
            title="Stop"
            onClick={() => onStopComponent(projectName, component.name)}
            danger
          />
        ) : null}
        <ActionButton
          icon="code"
          title="Open in Editor"
          onClick={() => onOpenEditor(editorDir, component.editor)}
        />
        {mainPort && mainPort.status === 'in-use' && component.processOrigin === 'external' && (
          <ActionButton
            icon="kill"
            title={`Kill :${mainPort.port}`}
            onClick={() => onKillPort(mainPort.port)}
            danger
          />
        )}
      </div>
```

- [ ] **Step 2: Add play and stop icons to ActionButton**

Update the `icon` type and `iconMap`:

```typescript
function ActionButton({
  icon,
  title,
  onClick,
  danger = false
}: {
  icon: 'terminal' | 'code' | 'kill' | 'play' | 'stop'
  title: string
  onClick: () => void
  danger?: boolean
}): React.JSX.Element {
  const iconMap = {
    terminal: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3" />
    ),
    code: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    ),
    kill: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    ),
    play: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
    ),
    stop: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
    )
  }
```

- [ ] **Step 3: Add a managed/external visual indicator to StatusBadge area**

After the `StatusBadge`, add a small label when the process is managed:

```typescript
      <StatusBadge status={component.status} />
      {component.processOrigin === 'managed' && component.status === 'running' && (
        <span className="text-[9px] text-emerald-500/60 font-mono uppercase tracking-wider">m</span>
      )}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/ComponentRow.tsx
git commit -m "feat: add start/stop buttons and managed indicator to ComponentRow"
```

---

### Task 9: Update ProjectGroup and TrayDropdown to Pass New Props

**Files:**
- Modify: `src/renderer/src/components/ProjectGroup.tsx`
- Modify: `src/renderer/src/components/TrayDropdown.tsx`

- [ ] **Step 1: Read ProjectGroup.tsx**

Read the current file to understand its props and how it renders ComponentRow.

- [ ] **Step 2: Update ProjectGroup to pass new props**

Add the new props to `ProjectGroup` and pass them through to `ComponentRow`:

```typescript
// Add to ProjectGroupProps:
  onStartComponent: (projectName: string, componentName: string) => void
  onStopComponent: (projectName: string, componentName: string) => void
```

Pass them to each `ComponentRow`:

```typescript
  <ComponentRow
    key={comp.name}
    component={comp}
    projectName={project.name}
    projectDir={project.directory}
    onOpenEditor={onOpenEditor}
    onKillPort={onKillPort}
    onStartComponent={onStartComponent}
    onStopComponent={onStopComponent}
  />
```

- [ ] **Step 3: Update TrayDropdown to pass new props**

In `TrayDropdown.tsx`, destructure the new actions from `useServiceState()`:

```typescript
  const { state, openTerminal, openEditor, openGitGui, killPort, openDashboard, startComponent, stopComponent } = useServiceState()
```

Pass them to each `ProjectGroup`:

```typescript
  <ProjectGroup
    key={project.name}
    project={project}
    onOpenTerminal={openTerminal}
    onOpenEditor={openEditor}
    onOpenGitGui={openGitGui}
    onKillPort={killPort}
    onStartComponent={startComponent}
    onStopComponent={stopComponent}
  />
```

- [ ] **Step 4: Update useServiceState hook to include new actions**

Read `src/renderer/src/hooks/useServiceState.ts` and add the new actions from the context.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/ProjectGroup.tsx src/renderer/src/components/TrayDropdown.tsx src/renderer/src/hooks/useServiceState.ts
git commit -m "feat: wire start/stop actions through tray dropdown component tree"
```

---

### Task 10: Dashboard ProjectsTab — Start/Stop All and Log Viewer

**Files:**
- Modify: `src/renderer/src/components/dashboard/ProjectsTab.tsx`

- [ ] **Step 1: Add start/stop all buttons to ProjectCard header**

In the `ProjectCard` component, add props and buttons:

```typescript
// Add to ProjectCard props:
  onStartProject: (projectName: string) => Promise<unknown>
  onStopProject: (projectName: string) => Promise<unknown>
  onStartComponent: (projectName: string, componentName: string) => Promise<unknown>
  onStopComponent: (projectName: string, componentName: string) => Promise<boolean>
```

In the card header, after the running count, add start/stop all buttons:

```typescript
          <span className="text-[12px] font-mono tabular-nums text-zinc-500">
            {runningCount}/{components.length}
          </span>

          <div className="flex items-center gap-1">
            {runningCount < components.length && (
              <button
                onClick={() => onStartProject(project.name)}
                className="px-2 py-1 text-[11px] text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors"
                title="Start All"
              >
                Start All
              </button>
            )}
            {runningCount > 0 && (
              <button
                onClick={() => onStopProject(project.name)}
                className="px-2 py-1 text-[11px] text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                title="Stop All"
              >
                Stop All
              </button>
            )}
          </div>
```

- [ ] **Step 2: Add start/stop buttons to ComponentDetail**

Add to `ComponentDetail` props:

```typescript
  onStartComponent: (projectName: string, componentName: string) => Promise<unknown>
  onStopComponent: (projectName: string, componentName: string) => Promise<boolean>
  projectName: string
```

In the actions area, add start/stop buttons:

```typescript
      <div className="flex items-center gap-1">
        {component.status === 'stopped' ? (
          <button
            onClick={() => onStartComponent(projectName, component.name)}
            className="px-2 py-1 text-[11px] text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors"
          >
            Start
          </button>
        ) : component.processOrigin === 'managed' ? (
          <button
            onClick={() => onStopComponent(projectName, component.name)}
            className="px-2 py-1 text-[11px] text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
          >
            Stop
          </button>
        ) : component.ports.some((p) => p.status === 'in-use') ? (
          <button
            onClick={() => {
              const activePort = component.ports.find((p) => p.status === 'in-use')
              if (activePort) onKillPort(activePort.port)
            }}
            className="px-2 py-1 text-[11px] text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
          >
            Kill
          </button>
        ) : null}
        <button
          onClick={() => onOpenTerminal(projectDir)}
          className="px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded transition-colors"
          title="Open in Terminal"
        >
          Terminal
        </button>
        <button
          onClick={() => onOpenEditor(projectDir)}
          className="px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded transition-colors"
          title="Open in Editor"
        >
          Editor
        </button>
      </div>
```

- [ ] **Step 3: Add a managed/external label next to component name**

In `ComponentDetail`, after the component name:

```typescript
        <div className="text-[13px] text-zinc-300 font-medium">
          {component.name}
          {component.processOrigin === 'managed' && component.status !== 'stopped' && (
            <span className="ml-1.5 text-[9px] font-mono uppercase tracking-wider text-emerald-500/50">managed</span>
          )}
          {component.processOrigin === 'external' && component.status !== 'stopped' && (
            <span className="ml-1.5 text-[9px] font-mono uppercase tracking-wider text-zinc-500">external</span>
          )}
        </div>
```

- [ ] **Step 4: Wire new props through ProjectsTab**

In the `ProjectsTab` component, destructure the new actions and pass them down:

```typescript
  const { state, openTerminal, openEditor, openGitGui, killPort, startComponent, stopComponent, startProject, stopProject } = useAppState()
```

Pass to `ProjectCard`:

```typescript
  <ProjectCard
    key={project.name}
    project={project}
    onOpenTerminal={openTerminal}
    onOpenEditor={openEditor}
    onOpenGitGui={openGitGui}
    onKillPort={killPort}
    onStartProject={startProject}
    onStopProject={stopProject}
    onStartComponent={startComponent}
    onStopComponent={stopComponent}
  />
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/dashboard/ProjectsTab.tsx
git commit -m "feat: add start/stop controls and managed/external labels to dashboard"
```

---

### Task 11: Log Viewer Panel in Dashboard

**Files:**
- Create: `src/renderer/src/components/dashboard/LogViewer.tsx`
- Modify: `src/renderer/src/components/dashboard/ProjectsTab.tsx`

- [ ] **Step 1: Create LogViewer component**

```typescript
// src/renderer/src/components/dashboard/LogViewer.tsx
import { useEffect, useRef, useState } from 'react'

interface LogViewerProps {
  projectName: string
  componentName: string
  onClose: () => void
}

export function LogViewer({ projectName, componentName, onClose }: LogViewerProps): React.JSX.Element {
  const [content, setContent] = useState('')
  const containerRef = useRef<HTMLPreElement>(null)
  const autoScrollRef = useRef(true)

  // Load initial content and start tailing
  useEffect(() => {
    window.api.getLog(projectName, componentName).then((log) => {
      setContent(log as string)
    })

    window.api.startLogTail(projectName, componentName)

    const unsubscribe = window.api.onLogData((data) => {
      setContent((prev) => prev + data.content)
    })

    return () => {
      unsubscribe()
      window.api.stopLogTail(projectName, componentName)
    }
  }, [projectName, componentName])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [content])

  const handleScroll = (): void => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50
  }

  return (
    <div className="flex flex-col border-t border-white/[0.06] bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
        <span className="text-[12px] font-mono text-zinc-400">
          {projectName}/{componentName}
        </span>
        <button
          onClick={onClose}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Close
        </button>
      </div>

      {/* Log content */}
      <pre
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-[200px] max-h-[300px] overflow-auto p-4 text-[11px] font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap break-all scrollbar-thin scrollbar-thumb-zinc-700"
      >
        {content || <span className="text-zinc-600 italic">No log output yet</span>}
      </pre>
    </div>
  )
}
```

- [ ] **Step 2: Add log viewer state to ProjectsTab**

In `ProjectsTab`, add state for the selected log:

```typescript
  const [activeLog, setActiveLog] = useState<{ projectName: string; componentName: string } | null>(null)
```

- [ ] **Step 3: Add a "Logs" button to ComponentDetail**

In `ComponentDetail`, add a Logs button in the actions area (only shown when the component has been started):

```typescript
        {component.status !== 'stopped' && (
          <button
            onClick={() => onViewLog(projectName, component.name)}
            className="px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded transition-colors"
          >
            Logs
          </button>
        )}
```

Add `onViewLog` to the `ComponentDetail` and `ProjectCard` props and wire it from `ProjectsTab`:

```typescript
  onViewLog: (projectName: string, componentName: string) => void
```

In `ProjectsTab`, pass it through:

```typescript
  onViewLog={(pn, cn) => setActiveLog({ projectName: pn, componentName: cn })}
```

- [ ] **Step 4: Render LogViewer at the bottom of ProjectsTab**

After the projects list:

```typescript
      {activeLog && (
        <LogViewer
          projectName={activeLog.projectName}
          componentName={activeLog.componentName}
          onClose={() => setActiveLog(null)}
        />
      )}
```

Import the component:

```typescript
import { LogViewer } from './LogViewer'
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/dashboard/LogViewer.tsx src/renderer/src/components/dashboard/ProjectsTab.tsx
git commit -m "feat: add log viewer panel to dashboard projects tab"
```

---

### Task 12: Build and Verify

- [ ] **Step 1: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run the dev build**

Run: `npm run dev`
Expected: App launches, tray icon appears, no console errors

- [ ] **Step 4: Fix any issues found**

Address any type errors, test failures, or runtime issues.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build and test issues for start/stop feature"
```
