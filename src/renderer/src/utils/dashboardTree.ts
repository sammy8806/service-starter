import type { AppStateView, ComponentStateView } from '../context/AppContext'

export interface TreeComponent {
  name: string
  status: ComponentStateView['status']
  processOrigin: ComponentStateView['processOrigin']
  hasConflict: boolean
  primaryPort?: number
}

export interface TreeProject {
  name: string
  directory: string
  components: TreeComponent[]
  hasConflict: boolean
  runningCount: number
  totalCount: number
}

/** Builds the ordered project/component tree for the dashboard left panel. */
export function buildDashboardTree(state: AppStateView): TreeProject[] {
  const projects = Object.values(state.projects).map((project) => {
    const components = Object.values(project.components)
      .map((c): TreeComponent => ({
        name: c.name,
        status: c.status,
        processOrigin: c.processOrigin,
        hasConflict: c.ports.some((p) => p.status === 'conflict'),
        primaryPort: c.ports[0]?.port
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return {
      name: project.name,
      directory: project.directory,
      components,
      hasConflict: components.some((c) => c.hasConflict),
      runningCount: components.filter((c) => c.status === 'running').length,
      totalCount: components.length
    }
  })

  return projects.sort((a, b) => a.name.localeCompare(b.name))
}
