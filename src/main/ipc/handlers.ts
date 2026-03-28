import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from './channels'
import { AppState, CentralConfig } from '../config/types'

interface HandlerDependencies {
  getState: () => AppState
  getConfig: () => CentralConfig
  saveConfig: (config: CentralConfig) => void
  openTerminal: (workDir: string) => void
  openEditor: (codeDir: string) => void
  killPort: (port: number) => Promise<boolean>
  openDashboard: () => void
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

  ipcMain.on(IPC_CHANNELS.OPEN_TERMINAL, (_event, workDir: string) => {
    deps.openTerminal(workDir)
  })

  ipcMain.on(IPC_CHANNELS.OPEN_EDITOR, (_event, codeDir: string) => {
    deps.openEditor(codeDir)
  })

  ipcMain.handle(IPC_CHANNELS.KILL_PORT, async (_event, port: number) => {
    return deps.killPort(port)
  })

  ipcMain.on(IPC_CHANNELS.OPEN_DASHBOARD, () => {
    deps.openDashboard()
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

/** Serialize state (convert Maps to plain objects for IPC) */
function serializeState(state: AppState): Record<string, unknown> {
  return {
    projects: state.projects,
    trayIcon: state.trayIcon,
    conflicts: state.conflicts
  }
}
