import { AppProvider } from './context/AppContext'
import { TrayDropdown } from './components/tray/TrayDropdown'
import { DashboardWindow } from './components/dashboard/DashboardWindow'
import { CommandLogView } from './components/command-log/CommandLogView'
import { PreviewAppProvider, isPreviewMode } from './screenshots/PreviewAppProvider'

function App(): React.JSX.Element {
  const hash = window.location.hash
  const isTray = hash === '#tray'
  const commandLog = parseCommandLogHash(hash)
  const content = isTray ? (
    <TrayView />
  ) : commandLog ? (
    <CommandLogView {...commandLog} />
  ) : (
    <DashboardWindow />
  )
  const Provider = isPreviewMode() ? PreviewAppProvider : AppProvider

  return <Provider>{content}</Provider>
}

function parseCommandLogHash(hash: string): { projectName: string; componentName: string } | null {
  if (!hash.startsWith('#command-log?')) return null

  const params = new URLSearchParams(hash.slice('#command-log?'.length))
  const projectName = params.get('project')
  const componentName = params.get('component')
  if (!projectName || !componentName) return null

  return { projectName, componentName }
}

function TrayView(): React.JSX.Element {
  return (
    <div className="flex items-start justify-center pt-1">
      <TrayDropdown />
    </div>
  )
}

export default App
