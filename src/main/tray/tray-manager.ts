import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import { TrayIconState } from '../config/types'

const ICON_DIR = join(__dirname, '../../resources/icons')

/**
 * Manages the system tray icon and its context menu.
 */
export class TrayManager {
  private tray: Tray | null = null
  private currentState: TrayIconState = 'grey'
  private onLeftClick: (() => void) | null = null
  private onOpenDashboard: (() => void) | null = null
  private onOpenSettings: (() => void) | null = null

  constructor(callbacks: {
    onLeftClick: () => void
    onOpenDashboard: () => void
    onOpenSettings: () => void
  }) {
    this.onLeftClick = callbacks.onLeftClick
    this.onOpenDashboard = callbacks.onOpenDashboard
    this.onOpenSettings = callbacks.onOpenSettings
  }

  create(): void {
    const icon = this.getIcon('grey')
    this.tray = new Tray(icon)
    this.tray.setToolTip('Service Starter')

    // Left-click opens the dropdown
    this.tray.on('click', () => {
      this.onLeftClick?.()
    })

    // Right-click shows the context menu (don't use setContextMenu which triggers on all clicks on macOS)
    this.tray.on('right-click', () => {
      this.tray?.popUpContextMenu(this.buildContextMenu())
    })
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }

  /** Update tray icon to reflect current state */
  setIconState(state: TrayIconState): void {
    if (this.currentState === state) return
    this.currentState = state

    if (this.tray) {
      this.tray.setImage(this.getIcon(state))
    }
  }

  /** Get the tray bounds (for positioning the dropdown window) */
  getBounds(): Electron.Rectangle | null {
    return this.tray?.getBounds() ?? null
  }

  private getIcon(state: TrayIconState): Electron.NativeImage {
    const filename = `${state}Template.png`
    const iconPath = join(ICON_DIR, filename)

    try {
      const image = nativeImage.createFromPath(iconPath)
      // Mark as template image for macOS (adapts to light/dark menu bar)
      image.setTemplateImage(true)
      return image
    } catch {
      // Fallback: create a simple 22x22 icon
      return nativeImage.createEmpty()
    }
  }

  private buildContextMenu(): Menu {
    return Menu.buildFromTemplate([
      {
        label: 'Open Dashboard',
        click: () => this.onOpenDashboard?.()
      },
      {
        label: 'Settings',
        click: () => this.onOpenSettings?.()
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit()
      }
    ])
  }
}
