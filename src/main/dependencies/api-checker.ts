import { execFile } from 'child_process'
import { DependencyState, ApiDependency } from '../config/types'
import { checkRequiredEnvVars } from '../config/env-resolver'

/**
 * Checks an API dependency by:
 * 1. Verifying required env vars are present
 * 2. Executing the check command
 */
export async function checkApiDependency(dep: ApiDependency): Promise<DependencyState> {
  // Check env vars first
  if (dep.envRequired && dep.envRequired.length > 0) {
    const missing = checkRequiredEnvVars(dep.envRequired)
    if (missing.length > 0) {
      return {
        dependency: dep,
        health: 'unhealthy',
        lastChecked: Date.now(),
        error: `Missing env vars: ${missing.join(', ')}`
      }
    }
  }

  // Run check command
  return new Promise((resolve) => {
    const parts = dep.check.split(/\s+/)
    const cmd = parts[0]
    const args = parts.slice(1)

    execFile(cmd, args, { timeout: 15000 }, (error, _stdout, stderr) => {
      if (error) {
        resolve({
          dependency: dep,
          health: 'unhealthy',
          lastChecked: Date.now(),
          error: stderr || error.message
        })
      } else {
        resolve({
          dependency: dep,
          health: 'healthy',
          lastChecked: Date.now()
        })
      }
    })
  })
}
