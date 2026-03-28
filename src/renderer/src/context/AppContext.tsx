import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

// Serialized versions of the main process types
export interface PortStateView {
  port: number
  label: string
  status: 'free' | 'in-use' | 'conflict'
  owner?: string
  pid?: number
  process?: string
}

export interface DependencyStateView {
  dependency: {
    type: string
    name?: string
    container?: string
  }
  health: 'healthy' | 'unhealthy' | 'unknown'
  lastChecked: number
  error?: string
}

export interface ComponentStateView {
  name: string
  status: 'running' | 'stopped' | 'warning'
  processOrigin: 'managed' | 'external' | 'none'
  ports: PortStateView[]
  dependencies: DependencyStateView[]
  editor?: string
  codeDir?: string
  workDir?: string
}

export interface ProjectStateView {
  name: string
  directory: string
  components: Record<string, ComponentStateView>
  dependencies: DependencyStateView[]
}

export interface PortConflictView {
  port: number
  type: 'static' | 'runtime'
  claimants: string[]
  activeProcess?: string
  activePid?: number
}

export interface AppStateView {
  projects: Record<string, ProjectStateView>
  trayIcon: 'grey' | 'green' | 'orange'
  conflicts: PortConflictView[]
}

const DEFAULT_STATE: AppStateView = {
  projects: {},
  trayIcon: 'grey',
  conflicts: []
}

interface AppContextType {
  state: AppStateView
  openTerminal: (workDir: string) => void
  openEditor: (codeDir: string, editor?: string) => void
  openGitGui: (dir: string) => void
  killPort: (port: number) => Promise<boolean>
  openDashboard: () => void
  startComponent: (projectName: string, componentName: string) => Promise<unknown>
  stopComponent: (projectName: string, componentName: string) => Promise<boolean>
  startProject: (projectName: string) => Promise<unknown>
  stopProject: (projectName: string) => Promise<unknown>
}

const AppContext = createContext<AppContextType>({
  state: DEFAULT_STATE,
  openTerminal: () => {},
  openEditor: () => {},
  openGitGui: () => {},
  killPort: async () => false,
  openDashboard: () => {},
  startComponent: async () => {},
  stopComponent: async () => false,
  startProject: async () => {},
  stopProject: async () => {}
})

export function AppProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState<AppStateView>(DEFAULT_STATE)

  useEffect(() => {
    // Fetch initial state
    window.api.getState().then((s) => setState(s as AppStateView))

    // Subscribe to updates
    const unsubscribe = window.api.onStateUpdate((s) => setState(s as AppStateView))

    return unsubscribe
  }, [])

  const value: AppContextType = {
    state,
    openTerminal: (workDir) => window.api.openTerminal(workDir),
    openEditor: (codeDir, editor) => window.api.openEditor(codeDir, editor),
    openGitGui: (dir) => window.api.openGitGui(dir),
    killPort: (port) => window.api.killPort(port),
    openDashboard: () => window.api.openDashboard(),
    startComponent: (projectName, componentName) => window.api.startComponent(projectName, componentName),
    stopComponent: (projectName, componentName) => window.api.stopComponent(projectName, componentName),
    startProject: (projectName) => window.api.startProject(projectName),
    stopProject: (projectName) => window.api.stopProject(projectName)
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppState(): AppContextType {
  return useContext(AppContext)
}
