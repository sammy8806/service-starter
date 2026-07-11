import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProvider, AppStateView } from '../../context/AppContext'
import { TrayDropdown } from './TrayDropdown'

// jsdom doesn't implement ResizeObserver
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function buildState(): AppStateView {
  return {
    trayIcon: 'green',
    conflicts: [],
    favorites: [],
    docker: { available: true, containers: [], missing: [] },
    projects: {
      bandai: {
        name: 'bandai',
        directory: '/work/bandai',
        dependencies: [],
        components: {
          frontend: {
            name: 'frontend',
            status: 'running',
            processOrigin: 'managed',
            ports: [{ port: 3000, label: 'web', status: 'in-use' }],
            dependencies: [],
            startedAt: Date.now() - 120_000
          },
          docs: {
            name: 'docs',
            status: 'stopped',
            processOrigin: 'none',
            ports: [{ port: 3001, label: 'docs', status: 'free' }],
            dependencies: []
          }
        }
      },
      idleproj: {
        name: 'idleproj',
        directory: '/work/idleproj',
        dependencies: [],
        components: {
          web: {
            name: 'web',
            status: 'stopped',
            processOrigin: 'none',
            ports: [{ port: 8080, label: 'web', status: 'free' }],
            dependencies: []
          }
        }
      }
    }
  }
}

const startComponent = vi.fn()

beforeEach(() => {
  startComponent.mockReset()
  // Stub the preload bridge used by AppContext + TrayDropdown.
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getState: () => Promise.resolve(buildState()),
    onStateUpdate: () => () => {},
    getFavorites: () => Promise.resolve([]),
    toggleFavorite: () => Promise.resolve([]),
    startComponent,
    stopComponent: vi.fn(),
    startProject: vi.fn(),
    stopProject: vi.fn(),
    restartComponent: vi.fn(),
    stopAllManaged: vi.fn(),
    copyToClipboard: vi.fn(),
    editManifest: vi.fn(),
    showProcessInfo: vi.fn(),
    tailLogs: vi.fn(),
    showContextMenu: vi.fn(),
    openDashboard: vi.fn(),
    openTerminal: vi.fn(),
    openEditor: vi.fn(),
    openGitGui: vi.fn(),
    killPort: () => Promise.resolve(true),
    closeWindow: vi.fn()
  }
})

function renderTray(): ReturnType<typeof render> {
  return render(
    <AppProvider>
      <TrayDropdown />
    </AppProvider>
  )
}

describe('TrayDropdown', () => {
  it('shows active and idle sections from state', async () => {
    renderTray()
    expect(await screen.findByText(/Active Projects \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/idle projects \(1\)/i)).toBeInTheDocument()
    expect(screen.getByText('frontend')).toBeInTheDocument()
  })

  it('filters rows by search query', async () => {
    renderTray()
    await screen.findByText('frontend')
    await userEvent.type(screen.getByPlaceholderText('Search…'), 'docs')
    await waitFor(() => expect(screen.queryByText('frontend')).not.toBeInTheDocument())
    expect(screen.getByText('docs')).toBeInTheDocument()
  })

  it('starts an idle component via its Start button', async () => {
    renderTray()
    const docsRow = (await screen.findByText('docs')).closest('div')!
    const startBtn = docsRow.querySelector('button[aria-label="Start"]') as HTMLButtonElement
    await userEvent.click(startBtn)
    expect(startComponent).toHaveBeenCalledWith('bandai', 'docs')
  })
})
