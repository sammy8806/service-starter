import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdleProjectsSection } from './IdleProjectsSection'
import { ProjectRow } from '../../utils/sortServices'

function idleProject(name: string, favorite = false): ProjectRow {
  const component = {
    name: 'web',
    status: 'stopped' as const,
    processOrigin: 'none' as const,
    ports: [{ port: 3000, label: 'web', status: 'free' as const }],
    dependencies: []
  }
  return {
    project: { name, directory: `/work/${name}`, components: { web: component }, dependencies: [] },
    isFavorite: favorite,
    runningCount: 0,
    totalCount: 1,
    components: [{ projectName: name, component, isRunning: false, isConflicting: false }]
  }
}

const handlers = {
  expandedProjects: new Set<string>(),
  searching: false,
  selectedId: null as string | null,
  now: Date.now(),
  onToggleExpanded: vi.fn(),
  onToggleFavorite: vi.fn(),
  onStartComponent: vi.fn(),
  onStopComponent: vi.fn(),
  onShowProjectMenu: vi.fn(),
  onShowComponentMenu: vi.fn()
}

describe('IdleProjectsSection', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<IdleProjectsSection projects={[]} {...handlers} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the count and collapses children by default', () => {
    render(<IdleProjectsSection projects={[idleProject('wifi'), idleProject('x32')]} {...handlers} />)
    expect(screen.getByText(/IDLE PROJECTS \(2\)/)).toBeInTheDocument()
    expect(screen.queryByText('web')).not.toBeInTheDocument()
  })
})
