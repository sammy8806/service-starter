import { AppProvider } from './context/AppContext'
import { TrayDropdown } from './components/tray/TrayDropdown'
import { DashboardWindow } from './components/dashboard/DashboardWindow'
import { PreviewAppProvider, isPreviewMode } from './screenshots/PreviewAppProvider'

function App(): React.JSX.Element {
  const hash = window.location.hash
  const isTray = hash === '#tray'
  const content = isTray ? <TrayView /> : <DashboardWindow />
  const Provider = isPreviewMode() ? PreviewAppProvider : AppProvider

  return <Provider>{content}</Provider>
}

function TrayView(): React.JSX.Element {
  return (
    <div className="flex items-start justify-center pt-1">
      <TrayDropdown />
    </div>
  )
}

export default App
