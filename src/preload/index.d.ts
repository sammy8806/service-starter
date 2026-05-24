import { ElectronAPI } from '@electron-toolkit/preload'

export type ContextMenuType =
  | 'running-service'
  | 'idle-service'
  | 'conflict-service'
  | 'active-project'
  | 'idle-project'
  | 'footer'

export interface ContextMenuPayload {
  projectName: string
  projectDir?: string
  componentName?: string
  port?: number
  pid?: number
}

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
  getFavorites: () => Promise<string[]>
  toggleFavorite: (projectName: string) => Promise<string[]>
  restartComponent: (projectName: string, componentName: string) => Promise<boolean>
  stopAllManaged: () => Promise<boolean>
  copyToClipboard: (text: string) => void
  editManifest: (projectDir: string) => void
  showProcessInfo: (pid: number) => void
  tailLogs: (projectName: string, componentName: string) => void
  showContextMenu: (type: ContextMenuType, payload: ContextMenuPayload) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ServiceStarterAPI
  }
}
