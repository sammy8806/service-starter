import { DockerDependency } from '../config/types'
import { getDocker, listDockerContainers, resetDockerClient } from './docker-checker'
import { findDockerContainer } from './docker-matching'

export interface DockerActionResult {
  success: boolean
  error?: string
}

function toDependency(container: string, image?: string): DockerDependency {
  return { type: 'docker', container, image }
}

async function resolveContainer(container: string, image?: string) {
  const containers = await listDockerContainers()
  return findDockerContainer(containers, toDependency(container, image))
}

export async function startDockerContainer(
  container: string,
  image?: string
): Promise<DockerActionResult> {
  try {
    const match = await resolveContainer(container, image)
    if (!match) {
      return { success: false, error: `Container "${container}" not found` }
    }
    if (match.State === 'running') {
      return { success: true }
    }

    await getDocker().getContainer(match.Id).start()
    return { success: true }
  } catch (err) {
    resetDockerClient()
    return { success: false, error: String(err) }
  }
}

export async function stopDockerContainer(
  container: string,
  image?: string
): Promise<DockerActionResult> {
  try {
    const match = await resolveContainer(container, image)
    if (!match) {
      return { success: false, error: `Container "${container}" not found` }
    }
    if (match.State !== 'running') {
      return { success: true }
    }

    await getDocker().getContainer(match.Id).stop()
    return { success: true }
  } catch (err) {
    resetDockerClient()
    return { success: false, error: String(err) }
  }
}

export async function startDockerContainerById(containerId: string): Promise<DockerActionResult> {
  try {
    const container = getDocker().getContainer(containerId)
    const inspect = await container.inspect()
    if (inspect.State.Running) {
      return { success: true }
    }
    await container.start()
    return { success: true }
  } catch (err) {
    resetDockerClient()
    return { success: false, error: String(err) }
  }
}

export async function stopDockerContainerById(containerId: string): Promise<DockerActionResult> {
  try {
    const container = getDocker().getContainer(containerId)
    const inspect = await container.inspect()
    if (!inspect.State.Running) {
      return { success: true }
    }
    await container.stop()
    return { success: true }
  } catch (err) {
    resetDockerClient()
    return { success: false, error: String(err) }
  }
}
