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
    // running=1, activePorts=1, conflicts=1
    expect(screen.getAllByText('1')).toHaveLength(3)
    expect(screen.getByText(/running/i)).toBeInTheDocument()
  })

  it('lists conflicts and the global port map row', () => {
    render(<OverviewDetail state={state} />)
    // :3000 appears in both the conflicts section and the port map table row
    expect(screen.getAllByText(/:3000/)).toHaveLength(2)
    expect(screen.getByText('shop')).toBeInTheDocument()
  })
})
