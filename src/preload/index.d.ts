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

export interface LogDataPayload {
  logFile: string
  content: string
  projectName?: string
  componentName?: string
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
  resizeWindow: (height: number) => void
  startComponent: (projectName: string, componentName: string) => Promise<{ pid: number; logFile: string }>
  stopComponent: (projectName: string, componentName: string) => Promise<boolean>
  startProject: (projectName: string) => Promise<boolean>
  stopProject: (projectName: string) => Promise<boolean>
  reassignPort: (
    projectName: string,
    componentName: string,
    portLabel: string,
    fromPort: number,
    newPort: number
  ) => Promise<{ ok: boolean; code?: string; message?: string; suggestedPort?: number }>
  getLog: (projectName: string, componentName: string) => Promise<string>
  startLogTail: (projectName: string, componentName: string, startOffset?: number) => void
  stopLogTail: (projectName: string, componentName: string) => void
  onLogData: (callback: (data: LogDataPayload) => void) => () => void
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
  selectDirectory: () => Promise<string | null>
  getComponentEnv: (projectName: string, componentName: string) => Promise<Record<string, string>>
  startDockerContainer: (container: string, image?: string) => Promise<{ success: boolean; error?: string }>
  stopDockerContainer: (container: string, image?: string) => Promise<{ success: boolean; error?: string }>
  startDockerContainerById: (containerId: string) => Promise<{ success: boolean; error?: string }>
  stopDockerContainerById: (containerId: string) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ServiceStarterAPI
  }
}
