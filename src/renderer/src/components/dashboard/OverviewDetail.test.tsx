import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AppStateView } from '../../context/AppContext'
import { OverviewDetail } from './OverviewDetail'

vi.mock('../../context/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../context/AppContext')>()
  return {
    ...actual,
    useAppState: () => ({
      startComponent: vi.fn(),
      stopComponent: vi.fn(),
      reassignPort: vi.fn().mockResolvedValue({ ok: true })
    })
  }
})

const state: AppStateView = {
  trayIcon: 'orange',
  favorites: [],
  conflicts: [
    {
      port: 8090,
      type: 'static',
      claimants: ['bandai/backend', 'fmh/ocr'],
      activePid: 51002,
      activeProcess: 'java'
    }
  ],
  projects: {
    bandai: {
      name: 'bandai',
      directory: '/b',
      dependencies: [],
      components: {
        backend: {
          name: 'backend',
          status: 'running',
          processOrigin: 'managed',
          dependencies: [],
          ports: [{ port: 8090, label: 'http', status: 'in-use', pid: 51002, process: 'java' }]
        }
      }
    },
    fmh: {
      name: 'fmh',
      directory: '/f',
      dependencies: [],
      components: {
        ocr: {
          name: 'ocr',
          status: 'stopped',
          processOrigin: 'none',
          dependencies: [],
          ports: [{ port: 8090, label: 'http', status: 'conflict' }]
        }
      }
    }
  },
  docker: { available: true, containers: [], missing: [] }
}

describe('OverviewDetail (patchbay)', () => {
  it('renders the summary header', () => {
    render(<OverviewDetail state={state} />)
    expect(screen.getByText('localhost')).toBeInTheDocument()
    expect(screen.getByText(/1 contested/)).toBeInTheDocument()
  })

  it('renders the held and blocked port once', () => {
    render(<OverviewDetail state={state} />)
    expect(screen.getAllByText('8090')).toHaveLength(1)
    expect(screen.getByText(/holding/)).toBeInTheDocument()
    expect(screen.getByText('blocked')).toBeInTheDocument()
  })

  it('filters ports client-side', () => {
    const withIdlePort: AppStateView = {
      ...state,
      projects: {
        ...state.projects,
        docs: {
          name: 'docs',
          directory: '/docs',
          dependencies: [],
          components: {
            site: {
              name: 'site',
              status: 'stopped',
              processOrigin: 'none',
              dependencies: [],
              ports: [{ port: 3000, label: 'web', status: 'free' }]
            }
          }
        }
      }
    }
    render(<OverviewDetail state={withIdlePort} />)
    expect(screen.getByText('3000')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'contested' }))
    expect(screen.queryByText('3000')).not.toBeInTheDocument()
    expect(screen.getByText('8090')).toBeInTheDocument()
  })

  it('shows the empty state when there is nothing to show', () => {
    render(
      <OverviewDetail
        state={{
          ...state,
          projects: {},
          conflicts: [],
          docker: { available: true, containers: [], missing: [] }
        }}
      />
    )
    expect(screen.getByText(/No projects discovered/)).toBeInTheDocument()
  })
})
