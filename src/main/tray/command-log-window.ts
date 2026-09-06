import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const WINDOW_WIDTH = 1400
const WINDOW_HEIGHT = 340

/**
 * Wide, tray-adjacent window for watching one short-lived command's output.
 * It stays independent from the dashboard and hides when focus leaves it.
 */
export class CommandLogWindow {
  private window: BrowserWindow | null = null
  private showRequest = 0

  private create(): BrowserWindow {
    const window = new BrowserWindow({
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      minWidth: 600,
      minHeight: 220,
      show: false,
      frame: false,
      resizable: true,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      transparent: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    window.on('blur', () => this.hide())
    window.on('closed', () => {
      if (this.window === window) this.window = null
    })

    this.window = window
    return window
  }

  async show(
    projectName: string,
    componentName: string,
    trayBounds?: Electron.Rectangle | null
  ): Promise<void> {
    const window = this.window && !this.window.isDestroyed() ? this.window : this.create()
    const request = ++this.showRequest

    this.position(window, trayBounds)

    const hash = `#command-log?project=${encodeURIComponent(projectName)}&component=${encodeURIComponent(componentName)}`
    try {
      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        await window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${hash}`)
      } else {
        await window.loadFile(join(__dirname, '../renderer/index.html'), { hash: hash.slice(1) })
      }
    } catch {
      return
    }

    if (request !== this.showRequest || window.isDestroyed()) return
    window.show()
    window.focus()
  }

  hide(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide()
    }
  }

  isVisible(): boolean {
    return this.window?.isVisible() ?? false
  }

  destroy(): void {
    this.showRequest++
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy()
    }
    this.window = null
  }

  private position(window: BrowserWindow, trayBounds?: Electron.Rectangle | null): void {
    const display = trayBounds ? screen.getDisplayMatching(trayBounds) : screen.getPrimaryDisplay()
    const workArea = display.workArea
    const width = Math.min(WINDOW_WIDTH, Math.max(600, workArea.width - 16))

    if (window.getSize()[0] !== width) {
      window.setSize(width, WINDOW_HEIGHT, false)
    }

    let x = trayBounds
      ? Math.round(trayBounds.x + trayBounds.width / 2 - width / 2)
      : Math.round(workArea.x + (workArea.width - width) / 2)
    let y = trayBounds ? trayBounds.y + trayBounds.height + 8 : workArea.y + 40

    x = Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - width - 8))
    if (y + WINDOW_HEIGHT > workArea.y + workArea.height - 8) {
      y = trayBounds ? trayBounds.y - WINDOW_HEIGHT - 8 : workArea.y + 40
    }
    y = Math.max(workArea.y + 8, y)

    window.setPosition(x, y, false)
  }
}
