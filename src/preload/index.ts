import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Typed API exposed to the renderer
const api = {
  // State
  getState: () => ipcRenderer.invoke('state:get'),
  getProjects: () => ipcRenderer.invoke('projects:get'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config: unknown) => ipcRenderer.invoke('config:save', config),

  // Quick actions
  openTerminal: (workDir: string) => ipcRenderer.send('action:open-terminal', workDir),
  openEditor: (codeDir: string, editor?: string) => ipcRenderer.send('action:open-editor', codeDir, editor),
  openGitGui: (dir: string) => ipcRenderer.send('action:open-git-gui', dir),
  killPort: (port: number) => ipcRenderer.invoke('action:kill-port', port),

  // Window management
  openDashboard: () => ipcRenderer.send('window:open-dashboard'),
  closeWindow: () => ipcRenderer.send('window:close'),

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
  },

  // Favorites
  getFavorites: () => ipcRenderer.invoke('favorites:get'),
  toggleFavorite: (projectName: string) => ipcRenderer.invoke('favorites:toggle', projectName),

  // State update listener
  onStateUpdate: (callback: (state: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: unknown): void => callback(state)
    ipcRenderer.on('state:update', handler)
    return () => ipcRenderer.removeListener('state:update', handler)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
