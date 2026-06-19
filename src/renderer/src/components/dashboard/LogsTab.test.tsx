import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { LogsTab } from './LogsTab'

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getLog: vi.fn().mockResolvedValue('line one\nline two\n'),
    startLogTail: vi.fn(),
    stopLogTail: vi.fn(),
    onLogData: vi.fn().mockReturnValue(() => {}),
    copyToClipboard: vi.fn()
  }
})

describe('LogsTab', () => {
  type LogData = {
    logFile: string
    content: string
    projectName?: string
    componentName?: string
  }

  it('shows the external empty state when no Service Starter log exists', async () => {
    ;(window.api.getLog as ReturnType<typeof vi.fn>).mockResolvedValueOnce('')

    render(<LogsTab projectName="p" componentName="c" processOrigin="external" directory="/p" />)

    await waitFor(() => expect(screen.getByText(/external process/i)).toBeInTheDocument())
    expect(window.api.getLog).toHaveBeenCalledWith('p', 'c')
  })

  it('keeps Service Starter logs visible while a component is temporarily external', async () => {
    render(
      <LogsTab
        projectName="p"
        componentName="c"
        processOrigin="external"
        directory="/p"
        hasServiceLog
      />
    )

    await waitFor(() => expect(screen.getByText(/line one/)).toBeInTheDocument())
    expect(screen.queryByText(/external process/i)).not.toBeInTheDocument()
    expect(window.api.startLogTail).toHaveBeenCalledWith(
      'p',
      'c',
      new TextEncoder().encode('line one\nline two\n').length
    )
  })

  it('keeps external-status logs visible even before state reports hasServiceLog', async () => {
    render(<LogsTab projectName="p" componentName="c" processOrigin="external" directory="/p" />)

    await waitFor(() => expect(screen.getByText(/line one/)).toBeInTheDocument())
    expect(screen.queryByText(/external process/i)).not.toBeInTheDocument()
    expect(window.api.startLogTail).toHaveBeenCalledWith(
      'p',
      'c',
      new TextEncoder().encode('line one\nline two\n').length
    )
  })

  it('loads and renders initial log content for managed components', async () => {
    render(<LogsTab projectName="p" componentName="c" processOrigin="managed" directory="/p" />)
    await waitFor(() => expect(screen.getByText(/line one/)).toBeInTheDocument())
    expect(window.api.startLogTail).toHaveBeenCalledWith(
      'p',
      'c',
      new TextEncoder().encode('line one\nline two\n').length
    )
  })

  it('loads previous log content for stopped managed components without tailing', async () => {
    render(<LogsTab projectName="p" componentName="c" processOrigin="none" directory="/p" />)
    await waitFor(() => expect(screen.getByText(/line one/)).toBeInTheDocument())
    expect(window.api.getLog).toHaveBeenCalledWith('p', 'c')
    expect(window.api.startLogTail).not.toHaveBeenCalled()
    expect(window.api.onLogData).not.toHaveBeenCalled()
  })

  it('only appends log data for its own component+directory', async () => {
    let cb: (d: LogData) => void = () => {}
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
      cb({ logFile: '/projects/shop-extra/.service-starter/logs/web.log', content: 'PREFIX\n' })
      cb({ logFile: '/projects/shop/.service-starter/logs/web.log', content: 'MINE\n' })
    })
    await waitFor(() => expect(screen.getByText(/MINE/)).toBeInTheDocument())
    expect(screen.queryByText(/OTHER/)).not.toBeInTheDocument()
    expect(screen.queryByText(/PREFIX/)).not.toBeInTheDocument()
  })

  it('uses component metadata before falling back to path matching', async () => {
    let cb: (d: LogData) => void = () => {}
    ;(window.api.onLogData as ReturnType<typeof vi.fn>).mockImplementation((fn) => {
      cb = fn
      return () => {}
    })

    render(
      <LogsTab
        projectName="shop"
        componentName="web"
        processOrigin="managed"
        directory="/projects/shop"
      />
    )

    await waitFor(() => expect(window.api.startLogTail).toHaveBeenCalled())

    act(() => {
      cb({
        logFile: '/different/path/.service-starter/logs/web.log',
        content: 'STRUCTURED\n',
        projectName: 'shop',
        componentName: 'web'
      })
      cb({
        logFile: '/projects/shop/.service-starter/logs/web.log',
        content: 'WRONG\n',
        projectName: 'shop',
        componentName: 'api'
      })
    })

    await waitFor(() => expect(screen.getByText(/STRUCTURED/)).toBeInTheDocument())
    expect(screen.queryByText(/WRONG/)).not.toBeInTheDocument()
  })

  it('reloads and tails from the new log position when a stopped component starts', async () => {
    ;(window.api.getLog as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('previous run\n')
      .mockResolvedValueOnce('fresh startup\n')

    const { rerender } = render(
      <LogsTab projectName="p" componentName="c" processOrigin="none" directory="/p" />
    )

    await waitFor(() => expect(screen.getByText(/previous run/)).toBeInTheDocument())

    rerender(<LogsTab projectName="p" componentName="c" processOrigin="managed" directory="/p" />)

    await waitFor(() => expect(screen.getByText(/fresh startup/)).toBeInTheDocument())
    expect(screen.queryByText(/previous run/)).not.toBeInTheDocument()
    expect(window.api.startLogTail).toHaveBeenCalledWith(
      'p',
      'c',
      new TextEncoder().encode('fresh startup\n').length
    )
  })
})
