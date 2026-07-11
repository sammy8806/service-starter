import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startDockerContainer, stopDockerContainer } from './docker-control'

const mockStart = vi.fn()
const mockStop = vi.fn()
const mockGetContainer = vi.fn(() => ({ start: mockStart, stop: mockStop }))

vi.mock('./docker-checker', () => ({
  listDockerContainers: vi.fn(),
  getDocker: vi.fn(() => ({ getContainer: mockGetContainer })),
  resetDockerClient: vi.fn()
}))

import { listDockerContainers } from './docker-checker'

const containers = [
  {
    Id: 'abc123fullid',
    Names: ['/shop-platform_postgres_1'],
    Image: 'postgres:16-alpine',
    State: 'exited',
    Status: 'Exited (0) 5 minutes ago'
  }
]

beforeEach(() => {
  vi.mocked(listDockerContainers).mockResolvedValue(containers)
  mockStart.mockReset().mockResolvedValue(undefined)
  mockStop.mockReset().mockResolvedValue(undefined)
  mockGetContainer.mockClear()
})

describe('docker-control', () => {
  it('starts a stopped container by manifest name', async () => {
    const result = await startDockerContainer('postgres')
    expect(result.success).toBe(true)
    expect(mockGetContainer).toHaveBeenCalledWith('abc123fullid')
    expect(mockStart).toHaveBeenCalledOnce()
  })

  it('returns an error when the container does not exist', async () => {
    vi.mocked(listDockerContainers).mockResolvedValue([])
    const result = await startDockerContainer('missing')
    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('stops a running container', async () => {
    vi.mocked(listDockerContainers).mockResolvedValue([
      { ...containers[0], State: 'running', Status: 'Up 2 hours' }
    ])

    const result = await stopDockerContainer('postgres')
    expect(result.success).toBe(true)
    expect(mockStop).toHaveBeenCalledOnce()
  })

  it('no-ops when starting an already running container', async () => {
    vi.mocked(listDockerContainers).mockResolvedValue([
      { ...containers[0], State: 'running', Status: 'Up 2 hours' }
    ])

    const result = await startDockerContainer('postgres')
    expect(result.success).toBe(true)
    expect(mockStart).not.toHaveBeenCalled()
  })
})
