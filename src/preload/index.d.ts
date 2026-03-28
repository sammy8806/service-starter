import { ElectronAPI } from '@electron-toolkit/preload'

export interface ServiceStarterAPI {
  getState: () => Promise<unknown>
  getProjects: () => Promise<unknown>
  getConfig: () => Promise<unknown>
  saveConfig: (config: unknown) => Promise<boolean>
  openTerminal: (workDir: string) => void
  openEditor: (codeDir: string, editor?: string) => void
  openGitGui: (dir: string) => void
  killPort: (port: number) => Promise<boolean>
  openDashboard: () => void
  closeWindow: () => void
  startComponent: (projectName: string, componentName: string) => Promise<{ pid: number; logFile: string }>
  stopComponent: (projectName: string, componentName: string) => Promise<boolean>
  startProject: (projectName: string) => Promise<boolean>
  stopProject: (projectName: string) => Promise<boolean>
  getLog: (projectName: string, componentName: string) => Promise<string>
  startLogTail: (projectName: string, componentName: string) => void
  stopLogTail: (projectName: string, componentName: string) => void
  onLogData: (callback: (data: { logFile: string; content: string }) => void) => () => void
  onStateUpdate: (callback: (state: unknown) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ServiceStarterAPI
  }
}
