import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectDetail } from './ProjectDetail'
import type { ProjectStateView } from '../../context/AppContext'

const project: ProjectStateView = {
  name: 'shop',
  directory: '/shop',
  dependencies: [],
  components: {
    backend: {
      name: 'backend',
      status: 'running',
      processOrigin: 'managed',
      dependencies: [],
      ports: [{ port: 8090, label: 'api', status: 'in-use' }]
    },
    web: { name: 'web', status: 'stopped', processOrigin: 'none', dependencies: [], ports: [] }
  }
}

describe('ProjectDetail', () => {
  it('shows the running rollup and Start all / Stop all', () => {
    render(
      <ProjectDetail project={project} onStartProject={vi.fn()} onStopProject={vi.fn()} onSelectComponent={vi.fn()} />
    )
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start all/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stop all/i })).toBeInTheDocument()
  })

  it('selects a component when its row is clicked', () => {
    const onSelectComponent = vi.fn()
    render(
      <ProjectDetail
        project={project}
        onStartProject={vi.fn()}
        onStopProject={vi.fn()}
        onSelectComponent={onSelectComponent}
      />
    )
    fireEvent.click(screen.getByText('backend'))
    expect(onSelectComponent).toHaveBeenCalledWith('backend')
  })
})
