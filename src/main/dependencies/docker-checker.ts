import Dockerode from 'dockerode'
import { DockerDependency, DependencyState } from '../config/types'
import { findDockerContainer, normalizeContainerName, type ListedContainer } from './docker-matching'

let docker: Dockerode | null = null

function getDocker(): Dockerode {
  if (!docker) {
    docker = new Dockerode()
  }
  return docker
}

/** Reset cached client after connection failures so the next check retries. */
export function resetDockerClient(): void {
  docker = null
}

export async function listDockerContainers(): Promise<ListedContainer[]> {
  return getDocker().listContainers({ all: true }) as Promise<ListedContainer[]>
}

export function buildDockerDependencyState(
  dep: DockerDependency,
  containers: ListedContainer[],
  checkedAt = Date.now()
): DependencyState {
  const match = findDockerContainer(containers, dep)
  const matchedName = match?.Names.map(normalizeContainerName).find((name) =>
    name.toLowerCase().includes(dep.container.toLowerCase())
  ) ?? match?.Names.map(normalizeContainerName)[0]

  if (!match) {
    return {
      dependency: dep,
      health: 'unhealthy',
      lastChecked: checkedAt,
      error: `Container "${dep.container}" not found`,
      docker: {
        state: 'not_found',
        image: dep.image
      }
    }
  }

  const isRunning = match.State === 'running'
  return {
    dependency: dep,
    health: isRunning ? 'healthy' : 'unhealthy',
    lastChecked: checkedAt,
    error: isRunning ? undefined : `Container "${matchedName ?? dep.container}" is ${match.State}`,
    docker: {
      state: isRunning ? 'running' : 'stopped',
      matchedName,
      containerId: match.Id.slice(0, 12),
      image: match.Image,
      statusText: match.Status
    }
  }
}

/**
 * Checks if a Docker container is running by name (with Compose-friendly matching).
 */
export async function checkDockerDependency(dep: DockerDependency): Promise<DependencyState> {
  try {
    const containers = await listDockerContainers()
    return buildDockerDependencyState(dep, containers)
  } catch (err) {
    resetDockerClient()
    return {
      dependency: dep,
      health: 'unknown',
      lastChecked: Date.now(),
      error: `Docker not available: ${String(err)}`,
      docker: {
        state: 'unavailable'
      }
    }
  }
}
