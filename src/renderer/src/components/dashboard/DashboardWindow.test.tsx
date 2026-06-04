import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DashboardWindow } from './DashboardWindow'
import { AppProvider } from '../../context/AppContext'

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getState: vi.fn().mockResolvedValue({
      trayIcon: 'green',
      favorites: [],
      conflicts: [],
      projects: {
        shop: {
          name: 'shop',
          directory: '/shop',
          dependencies: [],
          components: {
            backend: { name: 'backend', status: 'running', processOrigin: 'managed', dependencies: [], ports: [{ port: 8090, label: 'api', status: 'in-use' }] }
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
    // 'shop' renders both as a tree button and (on Overview) as a port-map cell;
    // target the tree's project button specifically.
    await waitFor(() => expect(screen.getByRole('button', { name: /shop/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /shop/i }))
    // After expanding, 'backend' is a button in both the tree and the project rollup;
    // either selects the component — click the first (the tree row).
    fireEvent.click(screen.getAllByRole('button', { name: /backend/i })[0])
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Logs' })).toBeInTheDocument())
  })
})
