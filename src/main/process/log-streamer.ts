import { EventEmitter } from 'events'
import {
  readFileSync,
  existsSync,
  watch,
  statSync,
  openSync,
  readSync,
  closeSync,
  FSWatcher
} from 'fs'

interface TailState {
  watcher?: FSWatcher
  pollTimer: ReturnType<typeof setInterval>
  offset: number
  logFile: string
}

const LOG_POLL_INTERVAL_MS = 250

/**
 * Reads and tails log files, emitting new content for streaming to renderer.
 * Separate from ProcessManager -- only reads files, doesn't manage processes.
 */
export class LogStreamer extends EventEmitter {
  private tails = new Map<string, TailState>()

  getLog(logFile: string): string {
    if (!existsSync(logFile)) return ''
    try {
      return readFileSync(logFile, 'utf-8')
    } catch {
      return ''
    }
  }

  startTailing(logFile: string, startOffset?: number): void {
    // Stop existing tail on same file
    this.stopTailing(logFile)

    if (!existsSync(logFile)) return

    const stat = statSync(logFile)
    const offset =
      typeof startOffset === 'number' && Number.isFinite(startOffset) && startOffset >= 0
        ? Math.min(Math.floor(startOffset), stat.size)
        : stat.size

    let watcher: FSWatcher | undefined
    try {
      watcher = watch(logFile, () => {
        this.readNewContent(logFile)
      })
    } catch {
      watcher = undefined
    }

    const pollTimer = setInterval(() => {
      this.readNewContent(logFile)
    }, LOG_POLL_INTERVAL_MS)
    pollTimer.unref?.()

    this.tails.set(logFile, { watcher, pollTimer, offset, logFile })
    this.readNewContent(logFile)
  }

  stopTailing(logFile: string): void {
    const tail = this.tails.get(logFile)
    if (tail) {
      tail.watcher?.close()
      clearInterval(tail.pollTimer)
      this.tails.delete(logFile)
    }
  }

  stopAll(): void {
    for (const tail of this.tails.values()) {
      tail.watcher?.close()
      clearInterval(tail.pollTimer)
    }
    this.tails.clear()
  }

  private readNewContent(logFile: string): void {
    const tail = this.tails.get(logFile)
    if (!tail) return

    try {
      const stat = statSync(logFile)
      if (stat.size <= tail.offset) {
        // File was truncated (new run), reset offset
        if (stat.size < tail.offset) {
          tail.offset = 0
        } else {
          return
        }
      }

      const fd = openSync(logFile, 'r')
      const buf = Buffer.alloc(stat.size - tail.offset)
      readSync(fd, buf, 0, buf.length, tail.offset)
      closeSync(fd)

      tail.offset = stat.size

      const content = buf.toString('utf-8')
      if (content.length > 0) {
        this.emit('log-data', { logFile, content })
      }
    } catch {
      // File might be gone, ignore
    }
  }
}
