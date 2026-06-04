import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectTree } from './ProjectTree'
import type { TreeProject } from '../../utils/dashboardTree'

const tree: TreeProject[] = [
  {
    name: 'shop',
    directory: '/shop',
    hasConflict: true,
    runningCount: 1,
    totalCount: 2,
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

  it('expands a project to reveal components and selects one', () => {
    const onSelect = vi.fn()
    render(<ProjectTree tree={tree} selection={{ kind: 'overview' }} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('shop'))
    expect(screen.getByText(':8090')).toBeInTheDocument()
    expect(screen.getByText(':3000')).toBeInTheDocument()
    expect(screen.getAllByTitle('Port conflict').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('backend'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'component', projectName: 'shop', componentName: 'backend' })
  })
})
