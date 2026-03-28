import { execFile } from 'child_process'
import { DependencyState, ServiceDependency } from '../config/types'

/**
 * Checks a service dependency by executing its check command.
 * Exit code 0 = healthy, anything else = unhealthy.
 */
export async function checkServiceDependency(
  dep: ServiceDependency
): Promise<DependencyState> {
  return new Promise((resolve) => {
    // Split command into executable and args for execFile (safer than exec)
    const parts = dep.check.split(/\s+/)
    const cmd = parts[0]
    const args = parts.slice(1)

    execFile(cmd, args, { timeout: 10000 }, (error, _stdout, stderr) => {
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
