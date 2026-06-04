import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComponentDetail } from './ComponentDetail'
import type { ComponentStateView } from '../../context/AppContext'

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getComponentEnv: vi.fn().mockResolvedValue({}),
    getLog: vi.fn().mockResolvedValue(''),
    startLogTail: vi.fn(),
    stopLogTail: vi.fn(),
    onLogData: vi.fn().mockReturnValue(() => {}),
    copyToClipboard: vi.fn()
  }
})

const managed: ComponentStateView = {
  name: 'backend',
  status: 'running',
  processOrigin: 'managed',
  dependencies: [],
  ports: [{ port: 8090, label: 'api', status: 'in-use', pid: 4821 }]
}

describe('ComponentDetail', () => {
  it('renders the component header and a Stop action for a managed running service', () => {
    render(
      <ComponentDetail
        projectName="shop"
        directory="/shop"
        component={managed}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRestart={vi.fn()}
      />
    )
    expect(screen.getByText('backend')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('switches to the Ports tab when clicked', () => {
    render(
      <ComponentDetail
        projectName="shop"
        directory="/shop"
        component={managed}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRestart={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ports' }))
    expect(screen.getByText('api')).toBeInTheDocument()
  })
})
