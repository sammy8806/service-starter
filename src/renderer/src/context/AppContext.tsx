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
  ports: PortStateView[]
  dependencies: DependencyStateView[]
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
  openEditor: (codeDir: string) => void
  killPort: (port: number) => Promise<boolean>
  openDashboard: () => void
}

const AppContext = createContext<AppContextType>({
  state: DEFAULT_STATE,
  openTerminal: () => {},
  openEditor: () => {},
  killPort: async () => false,
  openDashboard: () => {}
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
    openEditor: (codeDir) => window.api.openEditor(codeDir),
    killPort: (port) => window.api.killPort(port),
    openDashboard: () => window.api.openDashboard()
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppState(): AppContextType {
  return useContext(AppContext)
}
