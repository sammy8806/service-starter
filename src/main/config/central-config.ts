import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import * as yaml from 'js-yaml'
import { CentralConfig } from './types'

const CONFIG_DIR = join(homedir(), '.config', 'service-starter')
const CONFIG_FILE = join(CONFIG_DIR, 'config.yml')

const DEFAULT_CONFIG: CentralConfig = {
  scanDirectories: [join(homedir(), 'work')],
  scanIntervalMs: 5000,
  portScanIntervalMs: 3000,
  editor: 'code',
  terminal: 'default'
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
