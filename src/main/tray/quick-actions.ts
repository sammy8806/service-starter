import { execFile } from 'child_process'
import { existsSync } from 'fs'

/**
 * Opens the given directory in the configured terminal.
 * Supports: default (Terminal.app on macOS), iTerm2, Warp, Alacritty, kitty.
 */
export function openInTerminal(workDir: string, terminal: string = 'default'): void {
  if (!existsSync(workDir)) {
    console.warn(`Directory not found: ${workDir}`)
    return
  }

  switch (terminal) {
    case 'iterm':
    case 'iTerm':
    case 'iTerm2':
      execFile('open', ['-a', 'iTerm', workDir])
      break
    case 'warp':
    case 'Warp':
      execFile('open', ['-a', 'Warp', workDir])
      break
    case 'alacritty':
      execFile('alacritty', ['--working-directory', workDir])
      break
    case 'kitty':
      execFile('kitty', ['--directory', workDir])
      break
    case 'default':
    default:
      // macOS Terminal.app
      execFile('open', ['-a', 'Terminal', workDir])
      break
  }
}

/**
 * Opens the given directory in the configured editor.
 */
export function openInEditor(codeDir: string, editor: string = 'code'): void {
  if (!existsSync(codeDir)) {
    console.warn(`Directory not found: ${codeDir}`)
    return
  }

  switch (editor) {
    case 'code':
    case 'vscode':
      execFile('code', [codeDir])
      break
    case 'cursor':
      execFile('cursor', [codeDir])
      break
    case 'zed':
      execFile('zed', [codeDir])
      break
    case 'idea':
      execFile('idea', [codeDir])
      break
    case 'webstorm':
      execFile('webstorm', [codeDir])
      break
    case 'sublime':
    case 'subl':
      execFile('subl', [codeDir])
      break
    default:
      execFile(editor, [codeDir])
      break
  }
}

/**
 * Kills the process listening on the given port.
 * Returns true if successful.
 */
export async function killProcessOnPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    // Use lsof to find the PID, then kill it
    execFile('lsof', ['-ti', `TCP:${port}`, '-sTCP:LISTEN'], (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve(false)
        return
      }

      const pids = stdout
        .trim()
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean)

      if (pids.length === 0) {
        resolve(false)
        return
      }

      // Kill each PID
      let killed = 0
      for (const pid of pids) {
        execFile('kill', ['-TERM', pid], (killErr) => {
          killed++
          if (killed === pids.length) {
            resolve(!killErr)
          }
        })
      }
    })
  })
}
