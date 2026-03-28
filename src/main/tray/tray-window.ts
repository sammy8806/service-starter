import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const WINDOW_WIDTH = 360
const WINDOW_HEIGHT = 480

/**
 * Manages the tray dropdown BrowserWindow.
 * Positioned below the tray icon, frameless, and auto-hides on blur.
 */
export class TrayWindow {
  private window: BrowserWindow | null = null

  create(): BrowserWindow {
    this.window = new BrowserWindow({
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      show: false,
      frame: false,
      resizable: false,
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

    // Hide on blur (clicking away)
    this.window.on('blur', () => {
      this.hide()
    })

    // Load the renderer
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#tray`)
    } else {
      this.window.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'tray' })
    }

    return this.window
  }

  /** Show the dropdown positioned below the tray icon */
  showBelowTray(trayBounds: Electron.Rectangle): void {
    if (!this.window) return

    const display = screen.getDisplayMatching(trayBounds)
    const displayBounds = display.workArea

    // Position below tray icon, centered horizontally
    let x = Math.round(trayBounds.x + trayBounds.width / 2 - WINDOW_WIDTH / 2)
    let y = trayBounds.y + trayBounds.height + 4

    // Keep within screen bounds
    if (x + WINDOW_WIDTH > displayBounds.x + displayBounds.width) {
      x = displayBounds.x + displayBounds.width - WINDOW_WIDTH
    }
    if (x < displayBounds.x) {
      x = displayBounds.x
    }

    this.window.setPosition(x, y, false)
    this.window.show()
    this.window.focus()
  }

  hide(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide()
    }
  }

  toggle(trayBounds: Electron.Rectangle): void {
    if (!this.window) {
      this.create()
    }

    if (this.window!.isVisible()) {
      this.hide()
    } else {
      this.showBelowTray(trayBounds)
    }
  }

  isVisible(): boolean {
    return this.window?.isVisible() ?? false
  }

  getWindow(): BrowserWindow | null {
    return this.window
  }

  destroy(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy()
    }
    this.window = null
  }
}
