import { EventEmitter } from 'events'
import { ActivePort, PortConflict, ResolvedProject, PortState } from '../config/types'
import { scanActivePorts } from './port-scanner'
import { buildPortOwnerMap, matchPortsForComponent } from './port-matcher'
import { detectConflicts } from './conflict-detector'

export interface MonitorState {
  activePorts: ActivePort[]
  conflicts: PortConflict[]
  componentPorts: Map<string, PortState[]> // key: "project/component"
}

/**
 * Orchestrates port scanning, matching, and conflict detection.
 * Runs on a configurable interval and emits state changes.
 */
export class PortMonitor extends EventEmitter {
  private timer: ReturnType<typeof setInterval> | null = null
  private state: MonitorState = {
    activePorts: [],
    conflicts: [],
    componentPorts: new Map()
  }

  constructor(private intervalMs: number) {
    super()
  }

  getState(): MonitorState {
    return { ...this.state }
  }

  start(): void {
    // Initial scan
    this.scan(new Map())

    // Note: periodic scan is started by the caller providing projects
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** Start periodic scanning with the current project set */
  startPeriodicScan(getProjects: () => Map<string, ResolvedProject>): void {
    this.stop()

    // Run immediately
    this.scan(getProjects())

    this.timer = setInterval(() => {
      this.scan(getProjects())
    }, this.intervalMs)
  }

  async scan(projects: Map<string, ResolvedProject>): Promise<void> {
    const activePorts = await scanActivePorts()
    const portOwnerMap = buildPortOwnerMap(projects)
    const conflicts = detectConflicts(projects, activePorts)

    const componentPorts = new Map<string, PortState[]>()

    for (const project of projects.values()) {
      for (const [compName, comp] of Object.entries(project.components)) {
        const key = `${project.name}/${compName}`
        const ports = matchPortsForComponent(
          project.name,
          compName,
          comp.ports,
          activePorts,
          portOwnerMap
        )
        componentPorts.set(key, ports)
      }
    }

    const newState: MonitorState = { activePorts, conflicts, componentPorts }

    // Check if state changed
    const changed =
      JSON.stringify(this.state.activePorts) !== JSON.stringify(newState.activePorts) ||
      JSON.stringify(this.state.conflicts) !== JSON.stringify(newState.conflicts)

    this.state = newState

    if (changed) {
      this.emit('state-changed', newState)
    }
  }
}
