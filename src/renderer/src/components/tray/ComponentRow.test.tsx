import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComponentRow } from './ComponentRow'
import { ComponentStateView } from '../../context/AppContext'

function comp(over: Partial<ComponentStateView> = {}): ComponentStateView {
  return {
    name: 'frontend',
    status: 'stopped',
    processOrigin: 'none',
    ports: [{ port: 3000, label: 'web', status: 'free' }],
    dependencies: [],
    ...over
  }
}

const noopHandlers = {
  projectName: 'bandai',
  projectDir: '/work/bandai',
  onStartComponent: vi.fn(),
  onStopComponent: vi.fn(),
  onOpenLogs: vi.fn(),
  onShowContextMenu: vi.fn(),
  selected: false,
  now: 1_000_000_000_000
}

describe('ComponentRow', () => {
  it('shows a Start button for an idle component and dispatches start', async () => {
    const onStartComponent = vi.fn()
    render(<ComponentRow {...noopHandlers} component={comp()} onStartComponent={onStartComponent} />)
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onStartComponent).toHaveBeenCalledWith('bandai', 'frontend')
  })

  it('shows uptime and a Stop button for a managed running component', () => {
    render(
      <ComponentRow
        {...noopHandlers}
        component={comp({
          status: 'running',
          processOrigin: 'managed',
          startedAt: noopHandlers.now - 120_000
        })}
      />
    )
    expect(screen.getByText('2m')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('shows an Open logs action for a command with output', async () => {
    const onOpenLogs = vi.fn()
    render(
      <ComponentRow
        {...noopHandlers}
        onOpenLogs={onOpenLogs}
        component={comp({
          type: 'command',
          hasServiceLog: true
        })}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Open logs' }))
    expect(onOpenLogs).toHaveBeenCalledWith('bandai', 'frontend')
  })

  it('raises the context menu on overflow click', async () => {
    const onShowContextMenu = vi.fn()
    render(<ComponentRow {...noopHandlers} component={comp()} onShowContextMenu={onShowContextMenu} />)
    await userEvent.click(screen.getByRole('button', { name: /more/i }))
    expect(onShowContextMenu).toHaveBeenCalled()
  })
})
