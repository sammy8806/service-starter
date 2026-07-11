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
  startLogTail: (projectName: string, componentName: string, startOffset?: number) => void
  stopLogTail: (projectName: string, componentName: string) => void
  getFavorites: () => string[]
  toggleFavorite: (projectName: string) => string[]
  restartComponent: (projectName: string, componentName: string) => Promise<void>
  stopAllManaged: () => Promise<void>
  copyToClipboard: (text: string) => void
  editManifest: (projectDir: string) => void
  showProcessInfo: (pid: number) => void
  tailLogs: (projectName: string, componentName: string) => void
  selectDirectory: () => Promise<string | null>
  getComponentEnv: (projectName: string, componentName: string) => Record<string, string>
  startDockerContainer: (container: string, image?: string) => Promise<{ success: boolean; error?: string }>
  stopDockerContainer: (container: string, image?: string) => Promise<{ success: boolean; error?: string }>
  startDockerContainerById: (containerId: string) => Promise<{ success: boolean; error?: string }>
  stopDockerContainerById: (containerId: string) => Promise<{ success: boolean; error?: string }>
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

  ipcMain.on(
    IPC_CHANNELS.LOG_START_TAIL,
    (_event, projectName: string, componentName: string, startOffset?: number) => {
      deps.startLogTail(projectName, componentName, startOffset)
    }
  )

  ipcMain.on(IPC_CHANNELS.LOG_STOP_TAIL, (_event, projectName: string, componentName: string) => {
    deps.stopLogTail(projectName, componentName)
  })

  ipcMain.handle(IPC_CHANNELS.RESTART_COMPONENT, async (_event, projectName: string, componentName: string) => {
    await deps.restartComponent(projectName, componentName)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.STOP_ALL_MANAGED, async () => {
    await deps.stopAllManaged()
    return true
  })

  ipcMain.on(IPC_CHANNELS.COPY_TO_CLIPBOARD, (_event, text: string) => {
    deps.copyToClipboard(text)
  })

  ipcMain.on(IPC_CHANNELS.EDIT_MANIFEST, (_event, projectDir: string) => {
    deps.editManifest(projectDir)
  })

  ipcMain.on(IPC_CHANNELS.SHOW_PROCESS_INFO, (_event, pid: number) => {
    void deps.showProcessInfo(pid)
  })

  ipcMain.on(IPC_CHANNELS.TAIL_LOGS, (_event, projectName: string, componentName: string) => {
    deps.tailLogs(projectName, componentName)
  })

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY, () => {
    return deps.selectDirectory()
  })

  ipcMain.handle(IPC_CHANNELS.COMPONENT_GET_ENV, (_event, projectName: string, componentName: string) => {
    return deps.getComponentEnv(projectName, componentName)
  })

  ipcMain.handle(
    IPC_CHANNELS.DOCKER_START,
    async (_event, container: string, image?: string) => deps.startDockerContainer(container, image)
  )

  ipcMain.handle(
    IPC_CHANNELS.DOCKER_STOP,
    async (_event, container: string, image?: string) => deps.stopDockerContainer(container, image)
  )

  ipcMain.handle(IPC_CHANNELS.DOCKER_START_ID, async (_event, containerId: string) =>
    deps.startDockerContainerById(containerId)
  )

  ipcMain.handle(IPC_CHANNELS.DOCKER_STOP_ID, async (_event, containerId: string) =>
    deps.stopDockerContainerById(containerId)
  )
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
export function pushLogDataToRenderers(
  logFile: string,
  content: string,
  context?: { projectName: string; componentName: string }
): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.LOG_DATA, { logFile, content, ...context })
    }
  }
}

/** Serialize state (convert Maps to plain objects for IPC) */
function serializeState(state: AppState): Record<string, unknown> {
  return {
    projects: state.projects,
    trayIcon: state.trayIcon,
    conflicts: state.conflicts,
    favorites: state.favorites,
    docker: state.docker
  }
}
