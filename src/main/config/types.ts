// ── Dependency types ────────────────────────────────────────────────

export type DependencyType = 'docker' | 'service' | 'api' | 'project'

export interface DockerDependency {
  type: 'docker'
  container: string
  image?: string
}

export interface ServiceDependency {
  type: 'service'
  name: string
  check: string
}

export interface ApiDependency {
  type: 'api'
  name: string
  check: string
  envRequired?: string[]
}

export interface ProjectDependency {
  type: 'project'
  name: string
}

export type Dependency = DockerDependency | ServiceDependency | ApiDependency | ProjectDependency

// ── Port declaration ────────────────────────────────────────────────

export interface PortDeclaration {
  port: number
  label: string
}

// ── Component ───────────────────────────────────────────────────────

export interface ComponentConfig {
  workDir?: string
  codeDir?: string
  editor?: string
  startCommand?: string
  ports: PortDeclaration[]
  env?: Record<string, string>
  dependencies?: Dependency[]
}

// ── Project manifest (.service-starter.yml) ─────────────────────────

export interface ProjectManifest {
  name: string
  components: Record<string, ComponentConfig>
  dependencies?: Dependency[]
}

// ── Central config (~/.config/service-starter/config.yml) ───────────

export interface ComponentOverride {
  ports?: PortDeclaration[]
}

export interface ProjectOverride {
  components?: Record<string, ComponentOverride>
}

export interface EditorConfig {
  command: string
}

export interface CentralConfig {
  scanDirectories: string[]
  scanIntervalMs: number
  portScanIntervalMs: number
  editor: string
  terminal: string
  gitGui: string
  editors?: Record<string, EditorConfig>
  overrides?: Record<string, ProjectOverride>
}

// ── Resolved project (manifest + central overrides applied) ─────────

export interface ResolvedProject {
  name: string
  directory: string
  components: Record<string, ComponentConfig>
  dependencies: Dependency[]
}

// ── Runtime state ───────────────────────────────────────────────────

export type PortStatus = 'free' | 'in-use' | 'conflict'
export type DependencyHealth = 'healthy' | 'unhealthy' | 'unknown'
export type ComponentStatus = 'running' | 'stopped' | 'warning'
export type ProcessOrigin = 'managed' | 'external' | 'none'
export type TrayIconState = 'grey' | 'green' | 'orange'

export interface ActivePort {
  port: number
  pid: number
  process: string
}

export interface PortState {
  port: number
  label: string
  status: PortStatus
  owner?: string // component name
  pid?: number
  process?: string
}

export interface DependencyState {
  dependency: Dependency
  health: DependencyHealth
  lastChecked: number
  error?: string
}

export interface ComponentState {
  name: string
  status: ComponentStatus
  processOrigin: ProcessOrigin
  ports: PortState[]
  dependencies: DependencyState[]
  editor?: string
  codeDir?: string
  workDir?: string
  startedAt?: number // epoch ms; only set for managed processes
  hasServiceLog?: boolean
}

export interface ProjectState {
  name: string
  directory: string
  components: Record<string, ComponentState>
  dependencies: DependencyState[]
}

export interface AppState {
  projects: Record<string, ProjectState>
  trayIcon: TrayIconState
  conflicts: PortConflict[]
  favorites: string[]
}

export interface PortConflict {
  port: number
  type: 'static' | 'runtime'
  claimants: string[] // "project/component" identifiers
  activeProcess?: string
  activePid?: number
}
