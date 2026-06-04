import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { LogsTab } from './LogsTab'

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getLog: vi.fn().mockResolvedValue('line one\nline two\n'),
    startLogTail: vi.fn(),
    stopLogTail: vi.fn(),
    onLogData: vi.fn().mockReturnValue(() => {})
  }
})

describe('LogsTab', () => {
  it('shows the external empty state for non-managed components', () => {
    render(<LogsTab projectName="p" componentName="c" processOrigin="external" directory="/p" />)
    expect(screen.getByText(/external process/i)).toBeInTheDocument()
    expect(window.api.getLog).not.toHaveBeenCalled()
  })

  it('loads and renders initial log content for managed components', async () => {
    render(<LogsTab projectName="p" componentName="c" processOrigin="managed" directory="/p" />)
    await waitFor(() => expect(screen.getByText(/line one/)).toBeInTheDocument())
    expect(window.api.startLogTail).toHaveBeenCalledWith('p', 'c')
  })

  it('only appends log data for its own component+directory', async () => {
    let cb: (d: { logFile: string; content: string }) => void = () => {}
    ;(window.api.onLogData as ReturnType<typeof vi.fn>).mockImplementation((fn) => {
      cb = fn
      return () => {}
    })
    render(
      <LogsTab
        projectName="p"
        componentName="web"
        processOrigin="managed"
        directory="/projects/shop"
      />
    )
    await waitFor(() => expect(window.api.startLogTail).toHaveBeenCalled())
    act(() => {
      cb({ logFile: '/projects/blog/.service-starter/logs/web.log', content: 'OTHER\n' })
      cb({ logFile: '/projects/shop/.service-starter/logs/web.log', content: 'MINE\n' })
    })
    await waitFor(() => expect(screen.getByText(/MINE/)).toBeInTheDocument())
    expect(screen.queryByText(/OTHER/)).not.toBeInTheDocument()
  })
})
