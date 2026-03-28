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
