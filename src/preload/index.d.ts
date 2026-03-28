import { ElectronAPI } from '@electron-toolkit/preload'

export interface ServiceStarterAPI {
  getState: () => Promise<unknown>
  getProjects: () => Promise<unknown>
  getConfig: () => Promise<unknown>
  saveConfig: (config: unknown) => Promise<boolean>
  openTerminal: (workDir: string) => void
  openEditor: (codeDir: string) => void
  killPort: (port: number) => Promise<boolean>
  openDashboard: () => void
  closeWindow: () => void
  onStateUpdate: (callback: (state: unknown) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ServiceStarterAPI
  }
}
