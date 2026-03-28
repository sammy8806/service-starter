import { readdirSync } from 'fs'
import { join } from 'path'
import { manifestExists, parseManifest, ParseResult } from '../config/manifest-parser'

export interface ScannedProject {
  directory: string
  parseResult: ParseResult
}

/**
 * Scans direct children of each scan directory for .service-starter.yml manifests.
 * Non-recursive: only looks at immediate subdirectories.
 */
export function scanDirectories(scanDirs: string[]): ScannedProject[] {
  const results: ScannedProject[] = []

  for (const scanDir of scanDirs) {
    try {
      const entries = readdirSync(scanDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        // Skip hidden directories
        if (entry.name.startsWith('.')) continue

        const projectDir = join(scanDir, entry.name)

        if (manifestExists(projectDir)) {
          const parseResult = parseManifest(projectDir)
          results.push({ directory: projectDir, parseResult })
        }
      }
    } catch (err) {
      // Scan directory doesn't exist or isn't readable — skip silently
      console.warn(`Failed to scan directory ${scanDir}:`, err)
    }
  }

  return results
}

/**
 * Returns all subdirectories in the scan dirs, whether or not they have a manifest.
 * Useful for showing "unconfigured" projects in the dashboard.
 */
export function listAllProjectDirs(scanDirs: string[]): string[] {
  const dirs: string[] = []

  for (const scanDir of scanDirs) {
    try {
      const entries = readdirSync(scanDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          dirs.push(join(scanDir, entry.name))
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  return dirs
}
