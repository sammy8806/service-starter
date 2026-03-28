import Dockerode from 'dockerode'
import { DockerDependency, DependencyState } from '../config/types'

let docker: Dockerode | null = null

function getDocker(): Dockerode {
  if (!docker) {
    docker = new Dockerode()
  }
  return docker
}

/**
 * Checks if a Docker container is running by name.
 */
export async function checkDockerDependency(
  dep: DockerDependency
): Promise<DependencyState> {
  try {
    const containers = await getDocker().listContainers({ all: true })
    const container = containers.find((c) =>
      c.Names.some((n) => n === `/${dep.container}` || n === dep.container)
    )

    if (!container) {
      return {
        dependency: dep,
        health: 'unhealthy',
        lastChecked: Date.now(),
        error: `Container "${dep.container}" not found`
      }
    }

    const isRunning = container.State === 'running'
    return {
      dependency: dep,
      health: isRunning ? 'healthy' : 'unhealthy',
      lastChecked: Date.now(),
      error: isRunning ? undefined : `Container "${dep.container}" is ${container.State}`
    }
  } catch (err) {
    return {
      dependency: dep,
      health: 'unknown',
      lastChecked: Date.now(),
      error: `Docker not available: ${err}`
    }
  }
}
