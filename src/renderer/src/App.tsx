import { AppProvider } from './context/AppContext'
import { TrayDropdown } from './components/TrayDropdown'
import { DashboardWindow } from './components/dashboard/DashboardWindow'

function App(): React.JSX.Element {
  const hash = window.location.hash

  return (
    <AppProvider>
      {hash === '#tray' ? <TrayView /> : <DashboardWindow />}
    </AppProvider>
  )
}

function TrayView(): React.JSX.Element {
  return (
    <div className="flex items-start justify-center pt-1">
      <TrayDropdown />
    </div>
  )
}

export default App
