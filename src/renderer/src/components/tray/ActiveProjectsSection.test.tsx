import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActiveProjectsSection } from './ActiveProjectsSection'
import { ProjectRow } from '../../utils/sortServices'

function activeProject(name: string): ProjectRow {
  const component = {
    name: 'api',
    status: 'running' as const,
    processOrigin: 'managed' as const,
    ports: [{ port: 3000, label: 'api', status: 'in-use' as const }],
    dependencies: [],
    startedAt: Date.now()
  }
  return {
    project: { name, directory: `/work/${name}`, components: { api: component }, dependencies: [] },
    isFavorite: false,
    runningCount: 1,
    totalCount: 1,
    components: [{ projectName: name, component, isRunning: true, isConflicting: false }]
  }
}

const handlers = {
  selectedId: null as string | null,
  now: Date.now(),
  collapsedProjects: new Set<string>(),
  searching: false,
  onToggleExpanded: vi.fn(),
  onToggleFavorite: vi.fn(),
  onStartComponent: vi.fn(),
  onStopComponent: vi.fn(),
  onShowProjectMenu: vi.fn(),
  onShowComponentMenu: vi.fn()
}

describe('ActiveProjectsSection', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<ActiveProjectsSection projects={[]} {...handlers} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows count and expands projects by default', () => {
    render(<ActiveProjectsSection projects={[activeProject('bandai')]} {...handlers} />)
    expect(screen.getByText(/Active Projects \(1\)/)).toBeInTheDocument()
    expect(screen.getByText('api')).toBeInTheDocument()
  })

  it('keeps running components visible when project is collapsed', () => {
    render(
      <ActiveProjectsSection
        {...handlers}
        projects={[activeProject('bandai')]}
        collapsedProjects={new Set(['bandai'])}
      />
    )
    // api is running — must remain visible even when collapsed
    expect(screen.getByText('api')).toBeInTheDocument()
  })
})
