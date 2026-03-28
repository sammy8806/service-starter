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
