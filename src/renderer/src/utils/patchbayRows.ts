import type { AppStateView, PortConflictView } from '../context/AppContext'

export type PortRowKind = 'idle' | 'running' | 'contested' | 'held'

export interface PatchbayClaimant {
  projectName: string
  componentName: string
  label: string
  status: 'running' | 'stopped' | 'warning'
  processOrigin: 'managed' | 'external' | 'none'
  isHolder: boolean
  pid?: number
  process?: string
}

export interface PatchbayPortRow {
  port: number
  kind: PortRowKind
  claimants: PatchbayClaimant[]
  externalHolder: boolean
  holderPid?: number
  holderProcess?: string
}

function findManagedHolder(
  claimants: PatchbayClaimant[],
  conflict: PortConflictView | undefined
): PatchbayClaimant | undefined {
  if (conflict?.activePid !== undefined) {
    return claimants.find(
      (claimant) => claimant.processOrigin === 'managed' && claimant.pid === conflict.activePid
    )
  }

  const candidates = claimants.filter(
    (claimant) =>
      claimant.processOrigin === 'managed' &&
      claimant.status === 'running' &&
      claimant.pid !== undefined
  )
  return candidates.length === 1 ? candidates[0] : undefined
}

export function buildPatchbayRows(state: AppStateView): PatchbayPortRow[] {
  const groups = new Map<number, PatchbayClaimant[]>()

  for (const project of Object.values(state.projects)) {
    for (const component of Object.values(project.components)) {
      for (const port of component.ports) {
        const claimants = groups.get(port.port) ?? []
        claimants.push({
          projectName: project.name,
          componentName: component.name,
          label: port.label,
          status: component.status,
          processOrigin: component.processOrigin,
          isHolder: false,
          pid: port.pid,
          process: port.process
        })
        groups.set(port.port, claimants)
      }
    }
  }

  const conflictByPort = new Map<number, PortConflictView>()
  for (const conflict of state.conflicts) conflictByPort.set(conflict.port, conflict)

  const rows: PatchbayPortRow[] = []
  for (const [port, claimants] of groups) {
    const conflict = conflictByPort.get(port)
    const managedHolder = findManagedHolder(claimants, conflict)
    if (managedHolder) managedHolder.isHolder = true

    const externalClaimant = claimants.find(
      (claimant) =>
        claimant.processOrigin === 'external' &&
        claimant.pid !== undefined &&
        (conflict?.activePid === undefined || claimant.pid === conflict.activePid)
    )
    const externalHolder =
      claimants.length > 1 &&
      !managedHolder &&
      (externalClaimant !== undefined || conflict?.activePid !== undefined)

    if (externalClaimant) externalClaimant.isHolder = true

    const hasHolder = managedHolder !== undefined || externalHolder
    const kind: PortRowKind =
      claimants.length > 1
        ? hasHolder
          ? 'held'
          : 'contested'
        : managedHolder || externalClaimant || claimants[0]?.status === 'running'
          ? 'running'
          : 'idle'

    rows.push({
      port,
      kind,
      claimants,
      externalHolder,
      holderPid: managedHolder?.pid ?? externalClaimant?.pid ?? conflict?.activePid,
      holderProcess: managedHolder?.process ?? externalClaimant?.process ?? conflict?.activeProcess
    })
  }

  return rows.sort((a, b) => a.port - b.port)
}

export function nextAvailablePort(rows: PatchbayPortRow[], from: number): number {
  const taken = new Set(rows.map((row) => row.port))
  let candidate = from + 1
  while (candidate <= 65535 && taken.has(candidate)) candidate++
  return candidate
}

export function summarize(state: AppStateView): {
  services: number
  running: number
  contested: number
  containersUp: number
} {
  const components = Object.values(state.projects).flatMap((project) =>
    Object.values(project.components)
  )
  const rows = buildPatchbayRows(state)

  return {
    services: components.length,
    running: components.filter((component) => component.status === 'running').length,
    contested: rows.filter((row) => row.kind === 'contested' || row.kind === 'held').length,
    containersUp: state.docker.containers.filter((container) => container.state === 'running')
      .length
  }
}
