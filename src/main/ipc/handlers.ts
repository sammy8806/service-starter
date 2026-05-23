import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from './channels'
import { AppState, CentralConfig } from '../config/types'

interface HandlerDependencies {
  getState: () => AppState
  getConfig: () => CentralConfig
  saveConfig: (config: CentralConfig) => void
  openTerminal: (workDir: string) => void
  openEditor: (codeDir: string, editor?: string) => void
  openGitGui: (dir: string) => void
  killPort: (port: number) => Promise<boolean>
  openDashboard: () => void
  startComponent: (projectName: string, componentName: string) => Promise<{ pid: number; logFile: string }>
  stopComponent: (projectName: string, componentName: string) => Promise<boolean>
  startProject: (projectName: string) => Promise<void>
  stopProject: (projectName: string) => Promise<void>
  getLog: (projectName: string, componentName: string) => string
  startLogTail: (projectName: string, componentName: string) => void
  stopLogTail: (projectName: string, componentName: string) => void
  getFavorites: () => string[]
  toggleFavorite: (projectName: string) => string[]
}

/**
 * Registers all IPC handlers for renderer → main communication.
 */
export function registerIpcHandlers(deps: HandlerDependencies): void {
  ipcMain.handle(IPC_CHANNELS.GET_STATE, () => {
    return serializeState(deps.getState())
  })

  ipcMain.handle(IPC_CHANNELS.GET_PROJECTS, () => {
    const state = deps.getState()
    return state.projects
  })

  ipcMain.handle(IPC_CHANNELS.GET_CONFIG, () => {
    return deps.getConfig()
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_CONFIG, (_event, config: CentralConfig) => {
    deps.saveConfig(config)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.FAVORITES_GET, () => {
    return deps.getFavorites()
  })

  ipcMain.handle(IPC_CHANNELS.FAVORITES_TOGGLE, (_event, projectName: string) => {
    return deps.toggleFavorite(projectName)
  })

  ipcMain.on(IPC_CHANNELS.OPEN_TERMINAL, (_event, workDir: string) => {
    deps.openTerminal(workDir)
  })

  ipcMain.on(IPC_CHANNELS.OPEN_EDITOR, (_event, codeDir: string, editor?: string) => {
    deps.openEditor(codeDir, editor)
  })

  ipcMain.on(IPC_CHANNELS.OPEN_GIT_GUI, (_event, dir: string) => {
    deps.openGitGui(dir)
  })

  ipcMain.handle(IPC_CHANNELS.KILL_PORT, async (_event, port: number) => {
    return deps.killPort(port)
  })

  ipcMain.on(IPC_CHANNELS.OPEN_DASHBOARD, () => {
    deps.openDashboard()
  })

  // Process management
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

  // Log streaming
  ipcMain.handle(IPC_CHANNELS.LOG_GET, (_event, projectName: string, componentName: string) => {
    return deps.getLog(projectName, componentName)
  })

  ipcMain.on(IPC_CHANNELS.LOG_START_TAIL, (_event, projectName: string, componentName: string) => {
    deps.startLogTail(projectName, componentName)
  })

  ipcMain.on(IPC_CHANNELS.LOG_STOP_TAIL, (_event, projectName: string, componentName: string) => {
    deps.stopLogTail(projectName, componentName)
  })
}

/**
 * Pushes state updates to all renderer windows.
 */
export function pushStateToRenderers(state: AppState): void {
  const serialized = serializeState(state)
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.STATE_UPDATE, serialized)
    }
  }
}

/**
 * Pushes log data to all renderer windows.
 */
export function pushLogDataToRenderers(logFile: string, content: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.LOG_DATA, { logFile, content })
    }
  }
}

/** Serialize state (convert Maps to plain objects for IPC) */
function serializeState(state: AppState): Record<string, unknown> {
  return {
    projects: state.projects,
    trayIcon: state.trayIcon,
    conflicts: state.conflicts,
    favorites: state.favorites
  }
}
