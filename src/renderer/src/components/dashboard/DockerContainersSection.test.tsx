import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DockerContainersSection } from './DockerContainersSection'
import type { DockerSnapshotView } from '../../context/AppContext'

const docker: DockerSnapshotView = {
  available: true,
  containers: [
    {
      id: 'a1b2c3d4e5f6',
      name: 'shop-platform_postgres_1',
      names: ['shop-platform_postgres_1'],
      image: 'postgres:16-alpine',
      state: 'running',
      status: 'Up 3 hours',
      usedBy: ['shop-platform']
    },
    {
      id: 'b2c3d4e5f6a7',
      name: 'rabbitmq',
      names: ['rabbitmq'],
      image: 'rabbitmq:3-management',
      state: 'exited',
      status: 'Exited (137) 10 minutes ago',
      usedBy: ['shop-platform/worker']
    }
  ],
  missing: [{ ref: 'clickhouse', usedBy: ['analytics'] }]
}

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    startDockerContainerById: vi.fn().mockResolvedValue({ success: true }),
    stopDockerContainerById: vi.fn().mockResolvedValue({ success: true })
  }
})

describe('DockerContainersSection', () => {
  it('shows actual docker container names, images, and status text', () => {
    render(<DockerContainersSection docker={docker} />)
    expect(screen.getByText('shop-platform_postgres_1')).toBeInTheDocument()
    expect(screen.getByText('postgres:16-alpine')).toBeInTheDocument()
    expect(screen.getByText('Up 3 hours')).toBeInTheDocument()
    expect(screen.getByText('Exited (137) 10 minutes ago')).toBeInTheDocument()
  })

  it('shows missing manifest refs separately', () => {
    render(<DockerContainersSection docker={docker} />)
    expect(screen.getByText('Declared in manifests but not found')).toBeInTheDocument()
    expect(screen.getAllByText('clickhouse').length).toBeGreaterThan(0)
  })

  it('starts a stopped container by docker id', async () => {
    render(<DockerContainersSection docker={docker} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() =>
      expect(window.api.startDockerContainerById).toHaveBeenCalledWith('b2c3d4e5f6a7')
    )
  })
})
