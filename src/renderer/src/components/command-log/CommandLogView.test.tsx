import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AppProvider } from '../../context/AppContext'
import { CommandLogView } from './CommandLogView'

const closeCommandLog = vi.fn()

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getState: vi.fn().mockResolvedValue({
      projects: {
        billing: {
          name: 'billing',
          directory: '/work/billing',
          dependencies: [],
          components: {
            migrate: {
              name: 'migrate',
              type: 'command',
              status: 'stopped',
              processOrigin: 'none',
              ports: [],
              dependencies: [],
              hasServiceLog: true
            }
          }
        }
      },
      trayIcon: 'grey',
      conflicts: [],
      favorites: [],
      docker: { available: true, containers: [], missing: [] }
    }),
    onStateUpdate: vi.fn().mockReturnValue(() => {}),
    getLog: vi.fn().mockResolvedValue('migration complete\n'),
    startLogTail: vi.fn(),
    stopLogTail: vi.fn(),
    onLogData: vi.fn().mockReturnValue(() => {}),
    closeCommandLog,
    copyToClipboard: vi.fn()
  }
  closeCommandLog.mockReset()
})

describe('CommandLogView', () => {
  it('renders only the command output and close control', async () => {
    render(
      <AppProvider>
        <CommandLogView projectName="billing" componentName="migrate" />
      </AppProvider>
    )

    await waitFor(() => expect(screen.getByText('migration complete')).toBeInTheDocument())
    expect(screen.getByText('FINISHED')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close command log' })).toBeInTheDocument()
    expect(screen.queryByText('Copy')).not.toBeInTheDocument()
    expect(screen.queryByText('Clear')).not.toBeInTheDocument()
  })

  it('closes through the window API', async () => {
    render(
      <AppProvider>
        <CommandLogView projectName="billing" componentName="migrate" />
      </AppProvider>
    )

    await waitFor(() => screen.getByRole('button', { name: 'Close command log' }))
    screen.getByRole('button', { name: 'Close command log' }).click()
    expect(closeCommandLog).toHaveBeenCalled()
  })
})
