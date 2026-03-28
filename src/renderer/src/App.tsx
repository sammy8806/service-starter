import { AppProvider } from './context/AppContext'
import { TrayDropdown } from './components/TrayDropdown'

function App(): React.JSX.Element {
  const hash = window.location.hash

  return (
    <AppProvider>
      {hash === '#tray' ? <TrayView /> : <DashboardView />}
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

function DashboardView(): React.JSX.Element {
  // Placeholder — will be built in Step 9
  return (
    <div className="flex items-center justify-center h-screen bg-zinc-900">
      <h1 className="text-2xl font-bold text-zinc-100">Service Starter Dashboard</h1>
    </div>
  )
}

export default App
