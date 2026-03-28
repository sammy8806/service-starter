import { watch, type FSWatcher } from 'chokidar'
import { join } from 'path'
import { EventEmitter } from 'events'

export type WatcherEvent = 'manifest-added' | 'manifest-changed' | 'manifest-removed'

const MANIFEST_FILENAME = '.service-starter.yml'

export interface FileWatcherEvents {
  'manifest-added': (projectDir: string) => void
  'manifest-changed': (projectDir: string) => void
  'manifest-removed': (projectDir: string) => void
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
      // Watch for .service-starter.yml in direct child directories
      const pattern = join(scanDir, '*', MANIFEST_FILENAME)

      const watcher = watch(pattern, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
      })

      watcher.on('add', (filePath: string) => {
        const projectDir = join(filePath, '..')
        this.emit('manifest-added', projectDir)
      })

      watcher.on('change', (filePath: string) => {
        const projectDir = join(filePath, '..')
        this.emit('manifest-changed', projectDir)
      })

      watcher.on('unlink', (filePath: string) => {
        const projectDir = join(filePath, '..')
        this.emit('manifest-removed', projectDir)
      })

      this.watchers.push(watcher)
    }
  }

  async stop(): Promise<void> {
    await Promise.all(this.watchers.map((w) => w.close()))
    this.watchers = []
  }
}
