import { EventEmitter } from 'events'
import { ResolvedProject, CentralConfig } from '../config/types'
import { parseManifest } from '../config/manifest-parser'
import { mergeConfig } from '../config/config-merger'
import { scanDirectories } from './project-scanner'
import { FileWatcher } from './file-watcher'

export type RegistryEvent = 'project-added' | 'project-updated' | 'project-removed' | 'rescan'

/**
 * In-memory store of all discovered projects and their parsed configs.
 * Reacts to file watcher events and periodic re-scans.
 */
export class ProjectRegistry extends EventEmitter {
  private projects = new Map<string, ResolvedProject>()
  private fileWatcher: FileWatcher | null = null
  private rescanTimer: ReturnType<typeof setInterval> | null = null

  constructor(private centralConfig: CentralConfig) {
    super()
  }

  /** Get all registered projects */
  getProjects(): Map<string, ResolvedProject> {
    return new Map(this.projects)
  }

  /** Get a specific project by directory */
  getProject(directory: string): ResolvedProject | undefined {
    return this.projects.get(directory)
  }

  /** Initial scan + start watching */
  start(): void {
    this.performScan()

    // Start file watcher
    this.fileWatcher = new FileWatcher(this.centralConfig.scanDirectories)

    this.fileWatcher.on('manifest-added', (dir: string) => this.handleManifestChange(dir))
    this.fileWatcher.on('manifest-changed', (dir: string) => this.handleManifestChange(dir))
    this.fileWatcher.on('project-config-changed', (dir: string) => this.handleManifestChange(dir))
    this.fileWatcher.on('manifest-removed', (dir: string) => this.handleManifestRemove(dir))

    this.fileWatcher.start()

    // Start periodic re-scan
    this.rescanTimer = setInterval(() => {
      this.performScan()
      this.emit('rescan')
    }, this.centralConfig.scanIntervalMs)
  }

  stop(): void {
    if (this.rescanTimer) {
      clearInterval(this.rescanTimer)
      this.rescanTimer = null
    }
    if (this.fileWatcher) {
      this.fileWatcher.stop()
      this.fileWatcher = null
    }
  }

  /** Update central config (e.g., when settings change) */
  updateConfig(config: CentralConfig): void {
    this.centralConfig = config
    // Re-resolve all projects with new config
    for (const dir of this.projects.keys()) {
      const { manifest } = parseManifest(dir)
      if (manifest) {
        const resolved = mergeConfig(manifest, dir, this.centralConfig)
        this.projects.set(dir, resolved)
        this.emit('project-updated', resolved)
      }
    }
  }

  private performScan(): void {
    const scanned = scanDirectories(this.centralConfig.scanDirectories)
    const currentDirs = new Set(this.projects.keys())
    const scannedDirs = new Set<string>()

    for (const { directory, parseResult } of scanned) {
      scannedDirs.add(directory)

      if (parseResult.manifest) {
        const resolved = mergeConfig(parseResult.manifest, directory, this.centralConfig)
        const existed = this.projects.has(directory)
        this.projects.set(directory, resolved)

        if (!existed) {
          this.emit('project-added', resolved)
        } else {
          this.emit('project-updated', resolved)
        }
      }
    }

    // Remove projects that no longer have manifests
    for (const dir of currentDirs) {
      if (!scannedDirs.has(dir)) {
        const project = this.projects.get(dir)
        this.projects.delete(dir)
        this.emit('project-removed', project)
      }
    }
  }

  private handleManifestChange(directory: string): void {
    const { manifest } = parseManifest(directory)
    if (manifest) {
      const resolved = mergeConfig(manifest, directory, this.centralConfig)
      const existed = this.projects.has(directory)
      this.projects.set(directory, resolved)

      if (!existed) {
        this.emit('project-added', resolved)
      } else {
        this.emit('project-updated', resolved)
      }
    }
  }

  private handleManifestRemove(directory: string): void {
    const project = this.projects.get(directory)
    if (project) {
      this.projects.delete(directory)
      this.emit('project-removed', project)
    }
  }
}
