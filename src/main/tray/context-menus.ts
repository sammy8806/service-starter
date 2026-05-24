import { ipcMain, Menu, MenuItemConstructorOptions } from 'electron'
import { IPC_CHANNELS } from '../ipc/channels'

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

export interface ContextMenuDeps {
  startComponent: (projectName: string, componentName: string) => void
  stopComponent: (projectName: string, componentName: string) => void
  restartComponent: (projectName: string, componentName: string) => void
  startProject: (projectName: string) => void
  stopProjectManaged: (projectName: string) => void
  killPort: (port: number) => void
  openTerminal: (dir: string) => void
  openEditor: (dir: string) => void
  openGitGui: (dir: string) => void
  copyToClipboard: (text: string) => void
  editManifest: (projectDir: string) => void
  showProcessInfo: (pid: number) => void
  tailLogs: (projectName: string, componentName: string) => void
  toggleFavorite: (projectName: string) => void
  isFavorite: (projectName: string) => boolean
  openDashboard: () => void
  openSettings: () => void
  stopAllManaged: () => void
}

const SEP: MenuItemConstructorOptions = { type: 'separator' }

function buildTemplate(
  type: ContextMenuType,
  p: ContextMenuPayload,
  d: ContextMenuDeps
): MenuItemConstructorOptions[] {
  const dir = p.projectDir ?? ''
  const comp = p.componentName ?? ''
  const url = p.port ? `http://localhost:${p.port}` : ''
  const pinLabel = d.isFavorite(p.projectName) ? 'Unpin Project' : 'Pin Project'

  switch (type) {
    case 'running-service':
      return [
        { label: 'Stop', click: () => d.stopComponent(p.projectName, comp) },
        { label: 'Restart', click: () => d.restartComponent(p.projectName, comp) },
        SEP,
        { label: 'Open Terminal', enabled: !!dir, click: () => d.openTerminal(dir) },
        { label: 'Open Editor', enabled: !!dir, click: () => d.openEditor(dir) },
        { label: 'Open Git GUI', enabled: !!dir, click: () => d.openGitGui(dir) },
        SEP,
        { label: 'Copy URL', enabled: !!url, click: () => d.copyToClipboard(url) },
        { label: 'Copy Port', enabled: !!p.port, click: () => d.copyToClipboard(String(p.port)) },
        { label: 'Tail Logs', click: () => d.tailLogs(p.projectName, comp) },
        SEP,
        { label: pinLabel, click: () => d.toggleFavorite(p.projectName) },
        { label: 'Settings…', click: () => d.openSettings() }
      ]
    case 'idle-service':
      return [
        { label: 'Start', click: () => d.startComponent(p.projectName, comp) },
        SEP,
        { label: 'Open Terminal', enabled: !!dir, click: () => d.openTerminal(dir) },
        { label: 'Open Editor', enabled: !!dir, click: () => d.openEditor(dir) },
        { label: 'Open Git GUI', enabled: !!dir, click: () => d.openGitGui(dir) },
        SEP,
        { label: 'Copy Port', enabled: !!p.port, click: () => d.copyToClipboard(String(p.port)) },
        SEP,
        { label: pinLabel, click: () => d.toggleFavorite(p.projectName) },
        { label: 'Edit Manifest', enabled: !!dir, click: () => d.editManifest(dir) },
        { label: 'Settings…', click: () => d.openSettings() }
      ]
    case 'conflict-service':
      return [
        { label: 'Kill Port', enabled: !!p.port, click: () => p.port && d.killPort(p.port) },
        { label: 'Show Process Info', enabled: !!p.pid, click: () => p.pid && d.showProcessInfo(p.pid) },
        SEP,
        { label: 'Open Terminal', enabled: !!dir, click: () => d.openTerminal(dir) },
        { label: 'Open Editor', enabled: !!dir, click: () => d.openEditor(dir) },
        SEP,
        { label: 'Copy PID', enabled: !!p.pid, click: () => d.copyToClipboard(String(p.pid)) },
        { label: 'Copy Port', enabled: !!p.port, click: () => d.copyToClipboard(String(p.port)) }
      ]
    case 'active-project':
      return [
        { label: 'Start missing services', click: () => d.startProject(p.projectName) },
        { label: 'Stop managed services', click: () => d.stopProjectManaged(p.projectName) },
        SEP,
        { label: 'Open Terminal', enabled: !!dir, click: () => d.openTerminal(dir) },
        { label: 'Open Editor', enabled: !!dir, click: () => d.openEditor(dir) },
        { label: 'Open Git GUI', enabled: !!dir, click: () => d.openGitGui(dir) },
        SEP,
        { label: pinLabel, click: () => d.toggleFavorite(p.projectName) },
        { label: 'Edit Manifest', enabled: !!dir, click: () => d.editManifest(dir) }
      ]
    case 'idle-project':
      return [
        { label: 'Start all', click: () => d.startProject(p.projectName) },
        SEP,
        { label: 'Open Terminal', enabled: !!dir, click: () => d.openTerminal(dir) },
        { label: 'Open Editor', enabled: !!dir, click: () => d.openEditor(dir) },
        { label: 'Open Git GUI', enabled: !!dir, click: () => d.openGitGui(dir) },
        SEP,
        { label: pinLabel, click: () => d.toggleFavorite(p.projectName) },
        { label: 'Edit Manifest', enabled: !!dir, click: () => d.editManifest(dir) }
      ]
    case 'footer':
      return [
        { label: 'Stop all managed services…', click: () => d.stopAllManaged() },
        { label: 'Settings…', click: () => d.openSettings() },
        { label: 'Open Dashboard', click: () => d.openDashboard() }
      ]
  }
}

const VALID_CONTEXT_MENU_TYPES = new Set<string>([
  'running-service', 'idle-service', 'conflict-service', 'active-project', 'idle-project', 'footer'
])

/** Registers the IPC listener that pops up a native menu for a row. */
export function registerContextMenuIpc(deps: ContextMenuDeps): void {
  ipcMain.on(
    IPC_CHANNELS.SHOW_CONTEXT_MENU,
    (_event, type: string, payload: ContextMenuPayload) => {
      if (!VALID_CONTEXT_MENU_TYPES.has(type)) return
      Menu.buildFromTemplate(buildTemplate(type as ContextMenuType, payload, deps)).popup()
    }
  )
}
