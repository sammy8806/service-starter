import { ActivePort, ResolvedProject, PortState } from '../config/types'

export interface PortOwner {
  projectName: string
  componentName: string
  label: string
}

function ownerId(owner: Pick<PortOwner, 'projectName' | 'componentName'>): string {
  return `${owner.projectName}/${owner.componentName}`
}

function hasMultipleDistinctOwners(owners: PortOwner[]): boolean {
  return new Set(owners.map(ownerId)).size > 1
}

/**
 * Builds a map of declared ports to their owners from resolved projects.
 */
export function buildPortOwnerMap(
  projects: Map<string, ResolvedProject>
): Map<number, PortOwner[]> {
  const portMap = new Map<number, PortOwner[]>()

  for (const project of projects.values()) {
    for (const [componentName, component] of Object.entries(project.components)) {
      for (const portDecl of component.ports) {
        const owners = portMap.get(portDecl.port) ?? []
        const nextOwnerId = ownerId({ projectName: project.name, componentName })
        if (owners.some((owner) => ownerId(owner) === nextOwnerId)) {
          continue
        }
        owners.push({
          projectName: project.name,
          componentName,
          label: portDecl.label
        })
        portMap.set(portDecl.port, owners)
      }
    }
  }

  return portMap
}

/**
 * Cross-references active ports against the port owner map
 * to produce PortState entries for a specific component.
 */
export function matchPortsForComponent(
  projectName: string,
  componentName: string,
  declaredPorts: { port: number; label: string }[],
  activePorts: ActivePort[],
  portOwnerMap: Map<number, PortOwner[]>
): PortState[] {
  return declaredPorts.map((decl) => {
    const active = activePorts.find((a) => a.port === decl.port)
    const owners = portOwnerMap.get(decl.port) ?? []

    // Check for static conflicts (multiple declarations)
    const hasStaticConflict = hasMultipleDistinctOwners(owners)

    if (!active) {
      return {
        port: decl.port,
        label: decl.label,
        status: hasStaticConflict ? 'conflict' : 'free',
        owner: `${projectName}/${componentName}`
      }
    }

    // Port is in use — check if the process is expected
    return {
      port: decl.port,
      label: decl.label,
      status: hasStaticConflict ? 'conflict' : 'in-use',
      owner: `${projectName}/${componentName}`,
      pid: active.pid,
      process: active.process
    }
  })
}
