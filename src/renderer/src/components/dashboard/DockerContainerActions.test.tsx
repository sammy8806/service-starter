import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DockerContainerActions } from './DockerContainerActions'
import type { DependencyStateView } from '../../context/AppContext'

const stoppedDep: DependencyStateView = {
  dependency: { type: 'docker', container: 'postgres' },
  health: 'unhealthy',
  lastChecked: Date.now(),
  docker: { state: 'stopped', matchedName: 'shop_postgres_1', statusText: 'Exited (0) 1 minute ago' }
}

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    startDockerContainer: vi.fn().mockResolvedValue({ success: true }),
    stopDockerContainer: vi.fn().mockResolvedValue({ success: true })
  }
})

describe('DockerContainerActions', () => {
  it('shows Start for a stopped container and calls the docker IPC API', async () => {
    render(<DockerContainerActions dep={stoppedDep} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() =>
      expect(window.api.startDockerContainer).toHaveBeenCalledWith('postgres', undefined)
    )
  })

  it('shows Stop for a running container', async () => {
    const runningDep: DependencyStateView = {
      ...stoppedDep,
      health: 'healthy',
      docker: { state: 'running', statusText: 'Up 1 hour' }
    }
    render(<DockerContainerActions dep={runningDep} />)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    await waitFor(() =>
      expect(window.api.stopDockerContainer).toHaveBeenCalledWith('postgres', undefined)
    )
  })

  it('renders nothing for a missing container', () => {
    const { container } = render(
      <DockerContainerActions
        dep={{
          ...stoppedDep,
          docker: { state: 'not_found' }
        }}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
