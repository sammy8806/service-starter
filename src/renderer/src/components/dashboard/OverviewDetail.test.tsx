import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverviewDetail } from './OverviewDetail'
import type { AppStateView } from '../../context/AppContext'

const state: AppStateView = {
  trayIcon: 'green',
  favorites: [],
  conflicts: [{ port: 3000, type: 'static', claimants: ['shop/web', 'blog/web'] }],
  projects: {
    shop: {
      name: 'shop',
      directory: '/shop',
      dependencies: [],
      components: {
        web: {
          name: 'web',
          status: 'running',
          processOrigin: 'managed',
          dependencies: [],
          ports: [{ port: 3000, label: 'web', status: 'conflict', process: 'node', pid: 4821 }]
        }
      }
    }
  }
}

describe('OverviewDetail', () => {
  it('shows KPI counts', () => {
    render(<OverviewDetail state={state} />)
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('Conflicts')).toBeInTheDocument()
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2)
  })

  it('lists conflicts and the global port map row', () => {
    render(<OverviewDetail state={state} />)
    // :3000 appears in both the conflicts section and the port map table row
    expect(screen.getAllByText(/:3000/)).toHaveLength(2)
    expect(screen.getByText('shop')).toBeInTheDocument()
  })

  it('renders duplicate conflict claimants once in the summary', () => {
    render(
      <OverviewDetail
        state={{
          ...state,
          conflicts: [
            {
              port: 3000,
              type: 'static',
              claimants: ['shop/web', 'shop/web', 'blog/web']
            }
          ]
        }}
      />
    )

    expect(screen.getAllByText('shop/web')).toHaveLength(1)
    expect(screen.getByText('blog/web')).toBeInTheDocument()
  })
})
