import type { AppStateView } from '../context/AppContext'

export interface DashboardKpis {
  running: number
  totalPorts: number
  activePorts: number
  conflicts: number
}

/** Aggregates running/port/conflict counts for the Overview KPI header. */
export function computeKpis(state: AppStateView): DashboardKpis {
  let running = 0
  let totalPorts = 0
  let activePorts = 0

  for (const project of Object.values(state.projects)) {
    for (const comp of Object.values(project.components)) {
      if (comp.status === 'running') running++
      for (const port of comp.ports) {
        totalPorts++
        if (port.status === 'in-use' || port.status === 'conflict') activePorts++
      }
    }
  }

  return { running, totalPorts, activePorts, conflicts: state.conflicts.length }
}
