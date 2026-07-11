import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectTree } from './ProjectTree'
import type { TreeProject } from '../../utils/dashboardTree'

const tree: TreeProject[] = [
  {
    name: 'shop',
    directory: '/shop',
    hasConflict: true,
    runningCount: 0,
    totalCount: 2,
    components: [
      { name: 'backend', status: 'stopped', processOrigin: 'none', hasConflict: false, primaryPort: 8090 },
      { name: 'web', status: 'stopped', processOrigin: 'none', hasConflict: true, primaryPort: 3000 }
    ]
  }
]

const runningTree: TreeProject[] = [
  {
    ...tree[0],
    runningCount: 1,
    components: [
      { name: 'backend', status: 'running', processOrigin: 'managed', hasConflict: false, primaryPort: 8090 },
      { name: 'web', status: 'stopped', processOrigin: 'none', hasConflict: true, primaryPort: 3000 }
    ]
  }
]

describe('ProjectTree', () => {
  it('renders the Overview node and selects it on click', () => {
    const onSelect = vi.fn()
    render(<ProjectTree tree={tree} selection={{ kind: 'project', projectName: 'shop' }} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Overview'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'overview' })
  })

  it('expands a project via chevron and selects a component', () => {
    const onSelect = vi.fn()
    render(<ProjectTree tree={tree} selection={{ kind: 'overview' }} onSelect={onSelect} />)
    fireEvent.click(screen.getByLabelText('Expand shop'))
    expect(screen.getByText(':8090')).toBeInTheDocument()
    expect(screen.getByText(':3000')).toBeInTheDocument()
    expect(screen.getAllByTitle('Port conflict').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'backend component' }))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'component', projectName: 'shop', componentName: 'backend' })
  })

  it('selects a project without toggling expand state', () => {
    const onSelect = vi.fn()
    render(<ProjectTree tree={tree} selection={{ kind: 'overview' }} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('shop'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'project', projectName: 'shop' })
    expect(screen.queryByText(':8090')).not.toBeInTheDocument()
  })

  it('auto-expands projects with running services', () => {
    render(<ProjectTree tree={runningTree} selection={{ kind: 'overview' }} onSelect={vi.fn()} />)
    expect(screen.getByText(':8090')).toBeInTheDocument()
  })

  it('filters projects by search query', () => {
    render(<ProjectTree tree={tree} selection={{ kind: 'overview' }} onSelect={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Filter projects'), { target: { value: 'backend' } })
    expect(screen.getByText('backend')).toBeInTheDocument()
    expect(screen.queryByText('web')).not.toBeInTheDocument()
  })
})
