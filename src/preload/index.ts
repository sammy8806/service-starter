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
  closeCommandLog: () => ipcRenderer.send('window:close-command-log'),
  resizeWindow: (height: number) => ipcRenderer.send('window:resize', height),

  // Process management
  startComponent: (projectName: string, componentName: string) =>
    ipcRenderer.invoke('process:start-component', projectName, componentName),
  stopComponent: (projectName: string, componentName: string) =>
    ipcRenderer.invoke('process:stop-component', projectName, componentName),
  startProject: (projectName: string) =>
    ipcRenderer.invoke('process:start-project', projectName),
  stopProject: (projectName: string) =>
    ipcRenderer.invoke('process:stop-project', projectName),
  reassignPort: (
    projectName: string,
    componentName: string,
    portLabel: string,
    fromPort: number,
    newPort: number
  ) =>
    ipcRenderer.invoke(
      'config:reassign-port',
      projectName,
      componentName,
      portLabel,
      fromPort,
      newPort
    ),

  // Log streaming
  getLog: (projectName: string, componentName: string) =>
    ipcRenderer.invoke('log:get', projectName, componentName),
  startLogTail: (projectName: string, componentName: string, startOffset?: number) =>
    ipcRenderer.send('log:start-tail', projectName, componentName, startOffset),
  stopLogTail: (projectName: string, componentName: string) =>
    ipcRenderer.send('log:stop-tail', projectName, componentName),
  onLogData: (
    callback: (data: {
      logFile: string
      content: string
      projectName?: string
      componentName?: string
    }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { logFile: string; content: string; projectName?: string; componentName?: string }
    ): void =>
      callback(data)
    ipcRenderer.on('log:data', handler)
    return () => ipcRenderer.removeListener('log:data', handler)
  },

  // Favorites
  getFavorites: () => ipcRenderer.invoke('favorites:get'),
  toggleFavorite: (projectName: string) => ipcRenderer.invoke('favorites:toggle', projectName),

  // Service actions
  restartComponent: (projectName: string, componentName: string) =>
    ipcRenderer.invoke('process:restart-component', projectName, componentName),
  stopAllManaged: () => ipcRenderer.invoke('process:stop-all-managed'),
  copyToClipboard: (text: string) => ipcRenderer.send('action:copy', text),
  editManifest: (projectDir: string) => ipcRenderer.send('action:edit-manifest', projectDir),
  showProcessInfo: (pid: number) => ipcRenderer.send('action:show-process-info', pid),
  tailLogs: (projectName: string, componentName: string) =>
    ipcRenderer.send('log:tail-open', projectName, componentName),
  showContextMenu: (type: string, payload: unknown) =>
    ipcRenderer.send('menu:show', type, payload),

  // Dashboard
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  getComponentEnv: (projectName: string, componentName: string) =>
    ipcRenderer.invoke('component:get-env', projectName, componentName),
  startDockerContainer: (container: string, image?: string) =>
    ipcRenderer.invoke('docker:start-container', container, image),
  stopDockerContainer: (container: string, image?: string) =>
    ipcRenderer.invoke('docker:stop-container', container, image),
  startDockerContainerById: (containerId: string) =>
    ipcRenderer.invoke('docker:start-container-id', containerId),
  stopDockerContainerById: (containerId: string) =>
    ipcRenderer.invoke('docker:stop-container-id', containerId),

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
