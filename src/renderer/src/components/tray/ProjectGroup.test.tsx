import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectGroup } from './ProjectGroup'
import { ProjectStateView } from '../../context/AppContext'

function project(): ProjectStateView {
  return {
    name: 'bandai',
    directory: '/work/bandai',
    components: {
      frontend: {
        name: 'frontend',
        status: 'running',
        processOrigin: 'managed',
        ports: [{ port: 3000, label: 'web', status: 'in-use' }],
        dependencies: [],
        startedAt: Date.now()
      },
      docs: {
        name: 'docs',
        status: 'stopped',
        processOrigin: 'none',
        ports: [{ port: 3001, label: 'docs', status: 'free' }],
        dependencies: []
      }
    },
    dependencies: []
  }
}

const baseProps = {
  project: project(),
  components: Object.values(project().components).map((component) => ({
    projectName: 'bandai',
    component,
    isRunning: component.status === 'running',
    isConflicting: false
  })),
  expanded: true,
  isFavorite: false,
  runningCount: 1,
  totalCount: 2,
  onToggleExpanded: vi.fn(),
  onToggleFavorite: vi.fn(),
  onStartComponent: vi.fn(),
  onStopComponent: vi.fn(),
  onShowProjectMenu: vi.fn(),
  onShowComponentMenu: vi.fn(),
  selectedId: null as string | null,
  now: Date.now()
}

describe('ProjectGroup', () => {
  it('shows running/total and toggles favorite', async () => {
    const onToggleFavorite = vi.fn()
    render(<ProjectGroup {...baseProps} showStar={true} onToggleFavorite={onToggleFavorite} />)
    expect(screen.getByText('1/2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /pin bandai/i }))
    expect(onToggleFavorite).toHaveBeenCalledWith('bandai')
  })

  it('hides components when collapsed', () => {
    render(<ProjectGroup {...baseProps} expanded={false} />)
    expect(screen.queryByText('frontend')).not.toBeInTheDocument()
  })

  it('toggles expansion when the header is clicked', async () => {
    const onToggleExpanded = vi.fn()
    render(<ProjectGroup {...baseProps} onToggleExpanded={onToggleExpanded} />)
    await userEvent.click(screen.getByRole('button', { name: /bandai/i }))
    expect(onToggleExpanded).toHaveBeenCalledWith('bandai')
  })
})
