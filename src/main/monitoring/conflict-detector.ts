import { ActivePort, PortConflict, ResolvedProject } from '../config/types'
import { buildPortOwnerMap } from './port-matcher'

function uniqueClaimants(owners: { projectName: string; componentName: string }[]): string[] {
  return [...new Set(owners.map((o) => `${o.projectName}/${o.componentName}`))]
}

/**
 * Detects port conflicts across all projects.
 *
 * Static conflicts: two or more distinct project components declare the same port.
 * Runtime conflicts: a port is in use by a process that doesn't match the declaring component.
 */
export function detectConflicts(
  projects: Map<string, ResolvedProject>,
  activePorts: ActivePort[]
): PortConflict[] {
  const conflicts: PortConflict[] = []
  const portOwnerMap = buildPortOwnerMap(projects)
  const activePortMap = new Map<number, ActivePort>()

  for (const ap of activePorts) {
    activePortMap.set(ap.port, ap)
  }

  for (const [port, owners] of portOwnerMap) {
    const claimants = uniqueClaimants(owners)

    // Static conflict: multiple distinct declarations
    if (claimants.length > 1) {
      const active = activePortMap.get(port)
      conflicts.push({
        port,
        type: 'static',
        claimants,
        activeProcess: active?.process,
        activePid: active?.pid
      })
    }
  }

  // Runtime conflicts: port in use by unexpected process
  // (We skip this for now since we don't have process-to-component matching yet.
  //  A future enhancement could compare process names against startCommand hints.)

  return conflicts
}
