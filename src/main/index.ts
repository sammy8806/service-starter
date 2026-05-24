import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import { loadCentralConfig, saveCentralConfig } from './config/central-config'
import { loadFavorites, saveFavorites, toggleFavorite as toggleFav, isFavorite } from './config/favorites'
import { CentralConfig, AppState, TrayIconState, ProjectState, ComponentState, DependencyState, PortState } from './config/types'
import { ProjectRegistry } from './discovery/project-registry'
import { PortMonitor } from './monitoring/monitor'
import { HealthAggregator } from './dependencies/health-aggregator'
import { TrayManager } from './tray/tray-manager'
import { TrayWindow } from './tray/tray-window'
import { registerIpcHandlers, pushStateToRenderers, pushLogDataToRenderers } from './ipc/handlers'
import { openInTerminal, openInEditor, openInGitGui, killProcessOnPort, getProcessInfo, openManifest } from './tray/quick-actions'
import { registerContextMenuIpc } from './tray/context-menus'
import { ProcessManager } from './process/process-manager'
import { LogStreamer } from './process/log-streamer'
import { deriveComponentRuntimeState } from '../shared/component-runtime'

// ── State ─────────────────────────────────────────────────────────────

let centralConfig: CentralConfig
let favorites: string[] = []
const favoritesPath = (): string => join(app.getPath('userData'), 'favorites.json')
let projectRegistry: ProjectRegistry
let portMonitor: PortMonitor
let healthAggregator: HealthAggregator
let trayManager: TrayManager
let trayWindow: TrayWindow
let dashboardWindow: BrowserWindow | null = null
let processManager: ProcessManager
let logStreamer: LogStreamer

function buildAppState(): AppState {
  const projects: Record<string, ProjectState> = {}
  const registeredProjects = projectRegistry.getProjects()
  const monitorState = portMonitor.getState()
  const healthResults = healthAggregator.getResults()

  for (const [dir, project] of registeredProjects) {
    const components: Record<string, ComponentState> = {}

    for (const [compName, comp] of Object.entries(project.components)) {
      const key = `${project.name}/${compName}`
      const portStates: PortState[] = monitorState.componentPorts.get(key) ?? comp.ports.map((p) => ({
        port: p.port,
        label: p.label,
        status: 'free' as const,
        owner: key
      }))

      const depStates: DependencyState[] = (comp.dependencies ?? []).map((dep) => {
        const depKey = dep.type === 'docker' ? `docker:${dep.container}` :
                       dep.type === 'project' ? `project:${dep.name}` :
                       `${dep.type}:${dep.name}`
        return healthResults.get(depKey) ?? {
          dependency: dep,
          health: 'unknown' as const,
          lastChecked: 0
        }
      })

      const isManaged = processManager.isManagedRunning(project.name, compName)
      const runtimeState = deriveComponentRuntimeState({
        portStates,
        dependencies: depStates,
        isManaged
      })

      const managed = processManager.getManagedProcess(project.name, compName)
      const startedAt = managed ? Date.parse(managed.startedAt) : undefined

      components[compName] = {
        name: compName,
        status: runtimeState.status,
        processOrigin: runtimeState.processOrigin,
        ports: portStates,
        dependencies: depStates,
        editor: comp.editor,
        codeDir: comp.codeDir ? join(dir, comp.codeDir) : undefined,
        workDir: comp.workDir ? join(dir, comp.workDir) : undefined,
        startedAt: Number.isNaN(startedAt) ? undefined : startedAt
      }
    }

    // Project-level dependencies
    const projectDepStates: DependencyState[] = project.dependencies.map((dep) => {
      const depKey = dep.type === 'docker' ? `docker:${dep.container}` :
                     dep.type === 'project' ? `project:${dep.name}` :
                     `${dep.type}:${dep.name}`
      return healthResults.get(depKey) ?? {
        dependency: dep,
        health: 'unknown' as const,
        lastChecked: 0
      }
    })

    projects[project.name] = {
      name: project.name,
      directory: dir,
      components,
      dependencies: projectDepStates
    }
  }

  // Determine tray icon state
  const allComponents = Object.values(projects).flatMap((p) => Object.values(p.components))
  const hasRunning = allComponents.some((c) => c.status === 'running')
  const hasWarning = allComponents.some((c) => c.status === 'warning') ||
                     monitorState.conflicts.length > 0

  const trayIcon: TrayIconState = hasWarning ? 'orange' : hasRunning ? 'green' : 'grey'

  return {
    projects,
    trayIcon,
    conflicts: monitorState.conflicts,
    favorites
  }
}

function pushState(): void {
  const state = buildAppState()
  trayManager.setIconState(state.trayIcon)
  pushStateToRenderers(state)
}

// ── Dashboard Window ──────────────────────────────────────────────────

function createDashboardWindow(): void {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.focus()
    return
  }

  dashboardWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  dashboardWindow.on('ready-to-show', () => {
    dashboardWindow!.show()
  })

  dashboardWindow.on('closed', () => {
    dashboardWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    dashboardWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#dashboard`)
  } else {
    dashboardWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'dashboard' })
  }
}

// ── App Lifecycle ─────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Set app user model id
  electronApp.setAppUserModelId('com.service-starter')

  // Development shortcuts
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Hide dock icon (tray-only app on macOS)
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  // Load config
  centralConfig = loadCentralConfig()
  favorites = loadFavorites(favoritesPath())

  // Initialize modules
  projectRegistry = new ProjectRegistry(centralConfig)
  portMonitor = new PortMonitor(centralConfig.portScanIntervalMs)
  healthAggregator = new HealthAggregator(10000)
  processManager = new ProcessManager()
  logStreamer = new LogStreamer()

  // Create tray
  trayWindow = new TrayWindow()
  trayWindow.create()

  ipcMain.on('window:close', () => trayWindow.hide())
  ipcMain.on('window:resize', (_event, height: number) => trayWindow.resize(height))

  trayManager = new TrayManager({
    onLeftClick: () => {
      const bounds = trayManager.getBounds()
      if (bounds) {
        trayWindow.toggle(bounds)
      }
    },
    onOpenDashboard: createDashboardWindow,
    onOpenSettings: createDashboardWindow
  })
  trayManager.create()

  // ── Helper: start a component by name ─────────────────────────────
  async function startComponentByName(
    projectName: string,
    componentName: string
  ): Promise<{ pid: number; logFile: string }> {
    for (const [dir, project] of projectRegistry.getProjects()) {
      if (project.name === projectName) {
        const comp = project.components[componentName]
        if (comp && comp.startCommand) {
          return processManager.startComponent({
            projectName,
            componentName,
            startCommand: comp.startCommand,
            workDir: comp.workDir ? join(dir, comp.workDir) : dir,
            projectDir: dir,
            declaredPorts: comp.ports.map((port) => port.port),
            env: comp.env
          })
        }
      }
    }
    throw new Error(`Component ${projectName}/${componentName} not found or has no startCommand`)
  }

  // ── Helper: confirm and stop all managed services ─────────────────
  async function confirmAndStopAll(): Promise<void> {
    const choice = dialog.showMessageBoxSync({
      type: 'warning',
      buttons: ['Stop all', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: 'Stop all managed services?',
      detail: 'This stops every service that Service Starter started.'
    })
    if (choice !== 0) return
    const managed = processManager.getManagedProcesses()
    await Promise.all(
      [...managed.values()].map((m) => processManager.stopComponent(m.projectName, m.componentName))
    )
  }

  // Register IPC handlers
  registerIpcHandlers({
    getState: buildAppState,
    getConfig: () => centralConfig,
    saveConfig: (config: CentralConfig) => {
      centralConfig = config
      saveCentralConfig(config)
      projectRegistry.updateConfig(config)
    },
    openTerminal: (workDir: string) => openInTerminal(workDir, centralConfig.terminal),
    openEditor: (codeDir: string, editor?: string) =>
      openInEditor(codeDir, editor ?? centralConfig.editor, centralConfig.editors),
    openGitGui: (dir: string) => openInGitGui(dir, centralConfig.gitGui),
    killPort: killProcessOnPort,
    openDashboard: createDashboardWindow,
    startComponent: (projectName: string, componentName: string) =>
      startComponentByName(projectName, componentName),
    stopComponent: (projectName: string, componentName: string) =>
      processManager.stopComponent(projectName, componentName),
    startProject: async (projectName: string) => {
      for (const [dir, project] of projectRegistry.getProjects()) {
        if (project.name === projectName) {
          const starts = Object.entries(project.components)
            .filter(([_, comp]) => comp.startCommand)
            .map(([compName, comp]) =>
              processManager.startComponent({
                projectName,
                componentName: compName,
                startCommand: comp.startCommand!,
                workDir: comp.workDir ? join(dir, comp.workDir) : dir,
                projectDir: dir,
                declaredPorts: comp.ports.map((port) => port.port),
                env: comp.env
              })
            )
          await Promise.all(starts)
          return
        }
      }
    },
    stopProject: (projectName: string) => processManager.stopProject(projectName),
    getLog: (projectName: string, componentName: string) => {
      for (const [dir, project] of projectRegistry.getProjects()) {
        if (project.name === projectName) {
          const logFile = join(dir, '.service-starter', 'logs', `${componentName}.log`)
          return logStreamer.getLog(logFile)
        }
      }
      return ''
    },
    startLogTail: (projectName: string, componentName: string) => {
      for (const [dir, project] of projectRegistry.getProjects()) {
        if (project.name === projectName) {
          const logFile = join(dir, '.service-starter', 'logs', `${componentName}.log`)
          logStreamer.startTailing(logFile)
          return
        }
      }
    },
    stopLogTail: (projectName: string, componentName: string) => {
      for (const [dir, project] of projectRegistry.getProjects()) {
        if (project.name === projectName) {
          const logFile = join(dir, '.service-starter', 'logs', `${componentName}.log`)
          logStreamer.stopTailing(logFile)
          return
        }
      }
    },
    getFavorites: () => favorites,
    toggleFavorite: (projectName: string) => {
      favorites = toggleFav(favorites, projectName)
      saveFavorites(favoritesPath(), favorites)
      pushState()
      return favorites
    },
    restartComponent: async (projectName: string, componentName: string) => {
      await processManager.stopComponent(projectName, componentName)
      await startComponentByName(projectName, componentName)
    },
    stopAllManaged: confirmAndStopAll,
    copyToClipboard: (text: string) => clipboard.writeText(text),
    editManifest: (projectDir: string) =>
      openManifest(projectDir, centralConfig.editor, centralConfig.editors),
    showProcessInfo: async (pid: number) => {
      const info = await getProcessInfo(pid)
      dialog.showMessageBox({
        type: 'info',
        message: `Process ${pid}`,
        detail: info ?? 'Process not found (it may have exited).'
      })
    },
    tailLogs: (_projectName: string, _componentName: string) => {
      // v1: open the dashboard. Deep-linking to the component's Logs tab is a follow-up.
      createDashboardWindow()
    }
  })

  registerContextMenuIpc({
    startComponent: (p, c) => { void startComponentByName(p, c) },
    stopComponent: (p, c) => { void processManager.stopComponent(p, c) },
    restartComponent: async (p, c) => {
      await processManager.stopComponent(p, c)
      await startComponentByName(p, c)
    },
    startProject: (p) => {
      const managed = processManager.getManagedProcesses()
      for (const [_dir, project] of projectRegistry.getProjects()) {
        if (project.name !== p) continue
        for (const [compName, comp] of Object.entries(project.components)) {
          const alreadyRunning = [...managed.values()].some(
            (m) => m.projectName === p && m.componentName === compName
          )
          if (comp.startCommand && !alreadyRunning) void startComponentByName(p, compName)
        }
      }
    },
    stopProjectManaged: (p) => { void processManager.stopProject(p) },
    killPort: (port) => { void killProcessOnPort(port) },
    openTerminal: (dir) => openInTerminal(dir, centralConfig.terminal),
    openEditor: (dir) => openInEditor(dir, centralConfig.editor, centralConfig.editors),
    openGitGui: (dir) => openInGitGui(dir, centralConfig.gitGui),
    openInBrowser: (url) => { void shell.openExternal(url) },
    copyToClipboard: (text) => clipboard.writeText(text),
    editManifest: (dir) => openManifest(dir, centralConfig.editor, centralConfig.editors),
    showProcessInfo: (pid) => {
      void getProcessInfo(pid).then((info) => {
        void dialog.showMessageBox({
          type: 'info',
          message: `Process ${pid}`,
          detail: info ?? 'Process not found (it may have exited).'
        })
      })
    },
    tailLogs: () => createDashboardWindow(),
    toggleFavorite: (p) => {
      favorites = toggleFav(favorites, p)
      saveFavorites(favoritesPath(), favorites)
      pushState()
    },
    isFavorite: (p) => isFavorite(favorites, p),
    openDashboard: createDashboardWindow,
    openSettings: createDashboardWindow,
    stopAllManaged: () => { void confirmAndStopAll() }
  })

  // Start modules
  projectRegistry.start()

  // Reconnect to previously managed processes
  for (const [dir, _project] of projectRegistry.getProjects()) {
    processManager.reconnect(dir)
  }

  // Wire up state updates
  projectRegistry.on('project-added', pushState)
  projectRegistry.on('project-updated', pushState)
  projectRegistry.on('project-removed', pushState)

  portMonitor.startPeriodicScan(() => projectRegistry.getProjects())
  portMonitor.on('state-changed', pushState)

  healthAggregator.startPeriodicCheck(
    () => projectRegistry.getProjects(),
    () => portMonitor.getState().activePorts
  )
  healthAggregator.on('health-updated', pushState)

  processManager.on('process-started', pushState)
  processManager.on('process-stopped', pushState)

  logStreamer.on('log-data', ({ logFile, content }: { logFile: string; content: string }) => {
    pushLogDataToRenderers(logFile, content)
  })

  // Initial state push
  setTimeout(pushState, 1000)
})

// Prevent quitting when all windows closed (tray app)
app.on('window-all-closed', () => {
  // Don't quit — we're a tray app
})

// Clean up on quit
app.on('before-quit', () => {
  logStreamer?.stopAll()
  // Note: don't call processManager.stopAll() — processes are detached and should survive
  portMonitor?.stop()
  healthAggregator?.stop()
  projectRegistry?.stop()
  trayWindow?.destroy()
  trayManager?.destroy()
})
