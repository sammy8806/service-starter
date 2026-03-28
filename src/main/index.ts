import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import { loadCentralConfig, saveCentralConfig } from './config/central-config'
import { CentralConfig, AppState, TrayIconState, ProjectState, ComponentState, DependencyState, PortState } from './config/types'
import { ProjectRegistry } from './discovery/project-registry'
import { PortMonitor } from './monitoring/monitor'
import { HealthAggregator } from './dependencies/health-aggregator'
import { TrayManager } from './tray/tray-manager'
import { TrayWindow } from './tray/tray-window'
import { registerIpcHandlers, pushStateToRenderers } from './ipc/handlers'
import { openInTerminal, openInEditor, killProcessOnPort } from './tray/quick-actions'

// ── State ─────────────────────────────────────────────────────────────

let centralConfig: CentralConfig
let projectRegistry: ProjectRegistry
let portMonitor: PortMonitor
let healthAggregator: HealthAggregator
let trayManager: TrayManager
let trayWindow: TrayWindow
let dashboardWindow: BrowserWindow | null = null

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

      const hasActivePorts = portStates.some((p) => p.status === 'in-use')
      const hasIssue = portStates.some((p) => p.status === 'conflict') ||
                       depStates.some((d) => d.health === 'unhealthy')

      components[compName] = {
        name: compName,
        status: hasIssue ? 'warning' : hasActivePorts ? 'running' : 'stopped',
        ports: portStates,
        dependencies: depStates
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
    conflicts: monitorState.conflicts
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

  // Initialize modules
  projectRegistry = new ProjectRegistry(centralConfig)
  portMonitor = new PortMonitor(centralConfig.portScanIntervalMs)
  healthAggregator = new HealthAggregator(10000)

  // Create tray
  trayWindow = new TrayWindow()
  trayWindow.create()

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
    openEditor: (codeDir: string) => openInEditor(codeDir, centralConfig.editor),
    killPort: killProcessOnPort,
    openDashboard: createDashboardWindow
  })

  // Start modules
  projectRegistry.start()

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

  // Initial state push
  setTimeout(pushState, 1000)
})

// Prevent quitting when all windows closed (tray app)
app.on('window-all-closed', () => {
  // Don't quit — we're a tray app
})

// Clean up on quit
app.on('before-quit', () => {
  portMonitor?.stop()
  healthAggregator?.stop()
  projectRegistry?.stop()
  trayWindow?.destroy()
  trayManager?.destroy()
})
