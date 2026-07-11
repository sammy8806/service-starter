import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DashboardWindow } from './DashboardWindow'
import { AppProvider } from '../../context/AppContext'

beforeEach(() => {
  window.location.hash = '#dashboard'
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getState: vi.fn().mockResolvedValue({
      trayIcon: 'green',
      favorites: [],
      conflicts: [],
      docker: { available: true, containers: [], missing: [] },
      projects: {
        shop: {
          name: 'shop',
          directory: '/shop',
          dependencies: [],
          components: {
            backend: {
              name: 'backend',
              status: 'stopped',
              processOrigin: 'none',
              dependencies: [],
              ports: [{ port: 8090, label: 'api', status: 'free' }]
            }
          }
        }
      }
    }),
    onStateUpdate: vi.fn().mockReturnValue(() => {}),
    getConfig: vi.fn().mockResolvedValue({}),
    saveConfig: vi.fn(),
    selectDirectory: vi.fn(),
    getComponentEnv: vi.fn().mockResolvedValue({}),
    getLog: vi.fn().mockResolvedValue(''),
    startLogTail: vi.fn(),
    stopLogTail: vi.fn(),
    onLogData: vi.fn().mockReturnValue(() => {}),
    copyToClipboard: vi.fn(),
    startComponent: vi.fn(),
    stopComponent: vi.fn(),
    startProject: vi.fn(),
    stopProject: vi.fn(),
    restartComponent: vi.fn()
  }
})

function renderDashboard(): void {
  render(
    <AppProvider>
      <DashboardWindow />
    </AppProvider>
  )
}

describe('DashboardWindow', () => {
  it('defaults to the Overview detail', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Port Map')).toBeInTheDocument())
  })

  it('navigates to Settings via the top nav', async () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    await waitFor(() => expect(screen.getByText('Scan Directories')).toBeInTheDocument())
  })

  it('shows component detail when a component is selected in the tree', async () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }))
    await waitFor(() => expect(screen.getByLabelText('Expand shop')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Expand shop'))
    fireEvent.click(await screen.findByRole('button', { name: 'backend component' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Logs' })).toBeInTheDocument())
  })

  it('deep-links to a component via hash', async () => {
    window.location.hash = '#dashboard/component/shop/backend'
    renderDashboard()
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Logs' })).toBeInTheDocument())
  })
})
