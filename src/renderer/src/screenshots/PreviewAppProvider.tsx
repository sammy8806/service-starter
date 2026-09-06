import { createContext, useContext, ReactNode } from 'react'
import type { AppStateView } from '../context/AppContext'
import { AppProvider as RealAppProvider } from '../context/AppContext'
import { DEMO_CONFIG, DEMO_ENV, DEMO_LOG, DEMO_STATE } from './fixtures'

const noop = (): void => {}
const noopAsync = async (): Promise<unknown> => undefined
const noopBool = async (): Promise<boolean> => true
const noopArr = async (): Promise<string[]> => []

function installMockApi(): void {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getState: async () => DEMO_STATE,
    onStateUpdate: () => noop,
    getConfig: async () => DEMO_CONFIG,
    saveConfig: noopAsync,
    selectDirectory: async () => '/Users/dev/new-project',
    getComponentEnv: async () => DEMO_ENV,
    getLog: async () => DEMO_LOG,
    startLogTail: noop,
    stopLogTail: noop,
    onLogData: () => noop,
    copyToClipboard: noop,
    startComponent: noopAsync,
    stopComponent: noopBool,
    startProject: noopBool,
    stopProject: noopBool,
    restartComponent: noopBool,
    openTerminal: noop,
    openEditor: noop,
    openGitGui: noop,
    killPort: noopBool,
    openDashboard: noop,
    closeCommandLog: noop,
    toggleFavorite: noopArr,
    editManifest: noop,
    showContextMenu: noop,
    showProjectMenu: noop,
    showFooterMenu: noop,
    tailLogs: noop,
    hideWindow: noop,
    showProcessInfo: noop,
    stopAllManaged: noopBool,
    startDockerContainer: async () => ({ success: true }),
    stopDockerContainer: async () => ({ success: true }),
    startDockerContainerById: async () => ({ success: true }),
    stopDockerContainerById: async () => ({ success: true })
  }
}

const PreviewContext = createContext<AppStateView>(DEMO_STATE)

export function usePreviewState(): AppStateView {
  return useContext(PreviewContext)
}

export function PreviewAppProvider({ children }: { children: ReactNode }): React.JSX.Element {
  installMockApi()
  return (
    <PreviewContext.Provider value={DEMO_STATE}>
      <RealAppProvider>{children}</RealAppProvider>
    </PreviewContext.Provider>
  )
}

export function isPreviewMode(): boolean {
  return new URLSearchParams(window.location.search).get('preview') === '1'
}
