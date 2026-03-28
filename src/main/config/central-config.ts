import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import * as yaml from 'js-yaml'
import { CentralConfig, EditorConfig } from './types'

/** Built-in editor definitions — user config can override these */
export const BUILTIN_EDITORS: Record<string, EditorConfig> = {
  code: { command: 'code' },
  vscode: { command: 'code' },
  cursor: { command: 'cursor' },
  zed: { command: 'zed' },
  xcode: { command: 'open -a Xcode' },
  'android-studio': { command: 'open -a "Android Studio"' },
  idea: { command: 'idea' },
  webstorm: { command: 'webstorm' },
  sublime: { command: 'subl' },
  subl: { command: 'subl' }
}

/** Resolve an editor key to its config, checking user overrides first then built-ins */
export function resolveEditor(
  editorKey: string,
  userEditors?: Record<string, EditorConfig>
): EditorConfig | null {
  return userEditors?.[editorKey] ?? BUILTIN_EDITORS[editorKey] ?? null
}

const CONFIG_DIR = join(homedir(), '.config', 'service-starter')
const CONFIG_FILE = join(CONFIG_DIR, 'config.yml')

const DEFAULT_CONFIG: CentralConfig = {
  scanDirectories: [join(homedir(), 'work')],
  scanIntervalMs: 5000,
  portScanIntervalMs: 3000,
  editor: 'code',
  terminal: 'default',
  gitGui: 'fork'
}

export function getConfigPath(): string {
  return CONFIG_FILE
}

export function getDefaultConfig(): CentralConfig {
  return { ...DEFAULT_CONFIG, scanDirectories: [...DEFAULT_CONFIG.scanDirectories] }
}

export function loadCentralConfig(configPath: string = CONFIG_FILE): CentralConfig {
  if (!existsSync(configPath)) {
    return getDefaultConfig()
  }

  const raw = readFileSync(configPath, 'utf-8')
  const parsed = yaml.load(raw) as Partial<CentralConfig> | null

  if (!parsed || typeof parsed !== 'object') {
    return getDefaultConfig()
  }

  // Parse user-defined editors
  let editors: Record<string, EditorConfig> | undefined
  if (parsed.editors && typeof parsed.editors === 'object') {
    editors = {}
    for (const [key, value] of Object.entries(parsed.editors as Record<string, unknown>)) {
      if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).command === 'string') {
        editors[key] = { command: (value as Record<string, unknown>).command as string }
      }
    }
    if (Object.keys(editors).length === 0) editors = undefined
  }

  return {
    scanDirectories: Array.isArray(parsed.scanDirectories)
      ? parsed.scanDirectories.map(String)
      : DEFAULT_CONFIG.scanDirectories,
    scanIntervalMs:
      typeof parsed.scanIntervalMs === 'number'
        ? parsed.scanIntervalMs
        : DEFAULT_CONFIG.scanIntervalMs,
    portScanIntervalMs:
      typeof parsed.portScanIntervalMs === 'number'
        ? parsed.portScanIntervalMs
        : DEFAULT_CONFIG.portScanIntervalMs,
    editor: typeof parsed.editor === 'string' ? parsed.editor : DEFAULT_CONFIG.editor,
    terminal: typeof parsed.terminal === 'string' ? parsed.terminal : DEFAULT_CONFIG.terminal,
    gitGui: typeof parsed.gitGui === 'string' ? parsed.gitGui : DEFAULT_CONFIG.gitGui,
    editors,
    overrides: parsed.overrides
  }
}

export function saveCentralConfig(
  config: CentralConfig,
  configPath: string = CONFIG_FILE
): void {
  const dir = join(configPath, '..')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(configPath, yaml.dump(config, { lineWidth: -1 }), 'utf-8')
}
