import { watch, type FSWatcher } from 'chokidar'
import { basename, dirname, join } from 'path'
import { EventEmitter } from 'events'

export type WatcherEvent =
  | 'manifest-added'
  | 'manifest-changed'
  | 'manifest-removed'
  | 'project-config-changed'

const MANIFEST_FILENAME = '.service-starter.yml'
const COMPOSE_FILENAMES = [
  'compose.yaml',
  'compose.yml',
  'docker-compose.yml',
  'docker-compose.yaml'
]

export interface FileWatcherEvents {
  'manifest-added': (projectDir: string) => void
  'manifest-changed': (projectDir: string) => void
  'manifest-removed': (projectDir: string) => void
  'project-config-changed': (projectDir: string) => void
}

/**
 * Watches scan directories for .service-starter.yml changes using chokidar.
 * Emits events when manifests are added, changed, or removed.
 */
export class FileWatcher extends EventEmitter {
  private watchers: FSWatcher[] = []

  constructor(private scanDirs: string[]) {
    super()
  }

  start(): void {
    for (const scanDir of this.scanDirs) {
      // Watch manifests and default Compose files in direct child directories.
      const patterns = [MANIFEST_FILENAME, ...COMPOSE_FILENAMES].map((file) =>
        join(scanDir, '*', file)
      )

      const watcher = watch(patterns, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
      })

      watcher.on('add', (filePath: string) => {
        const projectDir = dirname(filePath)
        this.emit(
          basename(filePath) === MANIFEST_FILENAME ? 'manifest-added' : 'project-config-changed',
          projectDir
        )
      })

      watcher.on('change', (filePath: string) => {
        const projectDir = dirname(filePath)
        this.emit(
          basename(filePath) === MANIFEST_FILENAME ? 'manifest-changed' : 'project-config-changed',
          projectDir
        )
      })

      watcher.on('unlink', (filePath: string) => {
        const projectDir = dirname(filePath)
        this.emit(
          basename(filePath) === MANIFEST_FILENAME ? 'manifest-removed' : 'project-config-changed',
          projectDir
        )
      })

      this.watchers.push(watcher)
    }
  }

  async stop(): Promise<void> {
    await Promise.all(this.watchers.map((w) => w.close()))
    this.watchers = []
  }
}
