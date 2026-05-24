import { AppStateView, ComponentStateView, ProjectStateView } from '../context/AppContext'

export interface ConflictRow {
  port: number
  claimants: string[]
  primaryLabel: string
  activeProcess?: string
  activePid?: number
}

export interface ComponentRowData {
  projectName: string
  component: ComponentStateView
  isRunning: boolean
  isConflicting: boolean
}

export interface ProjectRow {
  project: ProjectStateView
  isFavorite: boolean
  runningCount: number
  totalCount: number
  components: ComponentRowData[]
}

export interface SortedSections {
  conflicts: ConflictRow[]
  active: ProjectRow[]
  idle: ProjectRow[]
}

function isComponentConflicting(c: ComponentStateView): boolean {
  return c.ports.some((p) => p.status === 'conflict')
}

export function sortServices(state: AppStateView, favorites: string[]): SortedSections {
  const favoriteSet = new Set(favorites)

  const conflicts: ConflictRow[] = state.conflicts
    .map((c) => ({
      port: c.port,
      claimants: c.claimants,
      primaryLabel: c.claimants[0] ?? `:${c.port}`,
      activeProcess: c.activeProcess,
      activePid: c.activePid
    }))
    .sort((a, b) => a.primaryLabel.localeCompare(b.primaryLabel) || a.port - b.port)

  const active: ProjectRow[] = []
  const idle: ProjectRow[] = []

  const projects = Object.values(state.projects).sort((a, b) => a.name.localeCompare(b.name))

  for (const project of projects) {
    const rows: ComponentRowData[] = Object.values(project.components).map((component) => ({
      projectName: project.name,
      component,
      isRunning: component.status === 'running',
      isConflicting: isComponentConflicting(component)
    }))

    const sortedRows = [...rows].sort((a, b) => {
      const aActive = a.isRunning || a.isConflicting
      const bActive = b.isRunning || b.isConflicting
      if (aActive !== bActive) return aActive ? -1 : 1
      return a.component.name.localeCompare(b.component.name)
    })

    const projectRow: ProjectRow = {
      project,
      isFavorite: favoriteSet.has(project.name),
      runningCount: rows.filter((r) => r.isRunning).length,
      totalCount: rows.length,
      components: sortedRows
    }

    if (rows.some((r) => r.isRunning)) active.push(projectRow)
    else idle.push(projectRow)
  }

  idle.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    return a.project.name.localeCompare(b.project.name)
  })

  return { conflicts, active, idle }
}
