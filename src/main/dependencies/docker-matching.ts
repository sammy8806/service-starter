import type { DockerDependency } from '../config/types'

export interface ListedContainer {
  Id: string
  Names: string[]
  Image: string
  State: string
  Status: string
}

/** Normalize a Docker name list entry to a bare container name. */
export function normalizeContainerName(name: string): string {
  return name.startsWith('/') ? name.slice(1) : name
}

/**
 * Match a manifest container reference against Docker name list entries.
 * Supports exact names and common Compose-generated suffixes.
 */
export function containerNameMatches(names: string[], target: string): boolean {
  const normalizedTarget = target.trim().toLowerCase()
  if (!normalizedTarget) return false

  return names.some((raw) => {
    const name = normalizeContainerName(raw).toLowerCase()
    if (name === normalizedTarget) return true
    if (name.endsWith(`_${normalizedTarget}`)) return true
    if (name.endsWith(`-${normalizedTarget}`)) return true
    if (name.endsWith(`_${normalizedTarget}_1`)) return true
    if (name.endsWith(`-${normalizedTarget}-1`)) return true
    if (name.includes(normalizedTarget)) return true
    return false
  })
}

export function imageMatches(image: string, target?: string): boolean {
  if (!target?.trim()) return false
  const normalizedTarget = target.trim().toLowerCase()
  const normalizedImage = image.toLowerCase()
  const base = normalizedImage.split('@')[0]
  const withoutTag = base.split(':')[0]
  return (
    normalizedImage === normalizedTarget ||
    base === normalizedTarget ||
    withoutTag === normalizedTarget ||
    normalizedImage.includes(normalizedTarget)
  )
}

export function findDockerContainer(
  containers: ListedContainer[],
  dep: DockerDependency
): ListedContainer | undefined {
  const byName = containers.find((c) => containerNameMatches(c.Names, dep.container))
  if (byName) return byName

  if (dep.image) {
    return containers.find((c) => imageMatches(c.Image, dep.image))
  }

  return undefined
}
