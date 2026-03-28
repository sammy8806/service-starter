import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { EditorConfig } from '../config/types'
import { resolveEditor } from '../config/central-config'

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
 * Resolves the editor key against user-defined and built-in editor configs.
 */
export function openInEditor(
  codeDir: string,
  editorKey: string = 'code',
  userEditors?: Record<string, EditorConfig>
): void {
  if (!existsSync(codeDir)) {
    console.warn(`Directory not found: ${codeDir}`)
    return
  }

  const editorConfig = resolveEditor(editorKey, userEditors)

  if (!editorConfig) {
    // Unknown editor key — try using it as a raw command
    console.warn(`Unknown editor "${editorKey}", attempting as raw command`)
    execFile(editorKey, [codeDir])
    return
  }

  const { command } = editorConfig

  // Commands like 'open -a Xcode' need to be split into binary + args
  const parts = parseCommand(command)
  execFile(parts[0], [...parts.slice(1), codeDir])
}

/** Split a command string into binary and arguments, respecting quotes */
function parseCommand(command: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuote: string | null = null

  for (const char of command) {
    if (inQuote) {
      if (char === inQuote) {
        inQuote = null
      } else {
        current += char
      }
    } else if (char === '"' || char === "'") {
      inQuote = char
    } else if (char === ' ') {
      if (current) {
        parts.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }
  if (current) parts.push(current)

  return parts
}

/**
 * Opens the given directory in the configured Git GUI client.
 * Supports: Fork, GitKraken, Sourcetree, GitHub Desktop, Tower.
 */
export function openInGitGui(dir: string, gitGui: string = 'fork'): void {
  if (!existsSync(dir)) {
    console.warn(`Directory not found: ${dir}`)
    return
  }

  switch (gitGui) {
    case 'fork':
      execFile('open', ['-a', 'Fork', dir])
      break
    case 'gitkraken':
      execFile('open', ['-a', 'GitKraken', dir])
      break
    case 'sourcetree':
      execFile('open', ['-a', 'Sourcetree', dir])
      break
    case 'github-desktop':
      execFile('open', ['-a', 'GitHub Desktop', dir])
      break
    case 'tower':
      execFile('open', ['-a', 'Tower', dir])
      break
    default:
      // Fallback: try opening as an app name
      execFile('open', ['-a', gitGui, dir])
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
