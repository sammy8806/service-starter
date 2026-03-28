import { ActivePort, PortConflict, ResolvedProject } from '../config/types'
import { buildPortOwnerMap, PortOwner } from './port-matcher'

/**
 * Detects port conflicts across all projects.
 *
 * Static conflicts: two or more manifests declare the same port.
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
    // Static conflict: multiple declarations
    if (owners.length > 1) {
      const active = activePortMap.get(port)
      conflicts.push({
        port,
        type: 'static',
        claimants: owners.map((o) => `${o.projectName}/${o.componentName}`),
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
