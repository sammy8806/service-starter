import type { DockerDependency, ResolvedProject } from '../config/types'
import { containerNameMatches, findDockerContainer, normalizeContainerName, type ListedContainer } from './docker-matching'
import { listDockerContainers, resetDockerClient } from './docker-checker'
import { mapListedContainer, type DockerContainerView } from './docker-list'

export interface DeclaredDockerRef {
  container: string
  image?: string
  usedBy: string[]
}

export function collectDeclaredDockerRefs(projects: Map<string, ResolvedProject>): DeclaredDockerRef[] {
  const refs = new Map<string, DeclaredDockerRef>()

  const add = (dep: DockerDependency, label: string): void => {
    const existing = refs.get(dep.container) ?? {
      container: dep.container,
      image: dep.image,
      usedBy: []
    }
    if (dep.image && !existing.image) existing.image = dep.image
    if (!existing.usedBy.includes(label)) existing.usedBy.push(label)
    refs.set(dep.container, existing)
  }

  for (const project of projects.values()) {
    for (const dep of project.dependencies) {
      if (dep.type === 'docker') add(dep, project.name)
    }
    for (const [compName, comp] of Object.entries(project.components)) {
      for (const dep of comp.dependencies ?? []) {
        if (dep.type === 'docker') add(dep, `${project.name}/${compName}`)
      }
    }
  }

  return [...refs.values()].sort((a, b) => a.container.localeCompare(b.container))
}

function buildUsedByMap(
  listed: ListedContainer[],
  declared: DeclaredDockerRef[]
): Map<string, string[]> {
  const usedBy = new Map<string, string[]>()

  for (const ref of declared) {
    const dep: DockerDependency = { type: 'docker', container: ref.container, image: ref.image }
    const match = findDockerContainer(listed, dep)
    if (!match) continue
    const existing = usedBy.get(match.Id) ?? []
    for (const label of ref.usedBy) {
      if (!existing.includes(label)) existing.push(label)
    }
    usedBy.set(match.Id, existing)
  }

  return usedBy
}

export async function buildDockerSnapshot(projects: Map<string, ResolvedProject>) {
  const declared = collectDeclaredDockerRefs(projects)

  try {
    const listed = await listDockerContainers()
    const usedByMap = buildUsedByMap(listed, declared)
    const containers: DockerContainerView[] = listed
      .map((container) => mapListedContainer(container, usedByMap.get(container.Id) ?? []))
      .sort((a, b) => a.name.localeCompare(b.name))

    const missing = declared
      .filter((ref) => !findDockerContainer(listed, { type: 'docker', container: ref.container, image: ref.image }))
      .map((ref) => ({
        ref: ref.container,
        image: ref.image,
        usedBy: ref.usedBy
      }))

    return {
      available: true,
      containers,
      missing
    }
  } catch (err) {
    resetDockerClient()
    return {
      available: false,
      error: String(err),
      containers: [],
      missing: declared.map((ref) => ({
        ref: ref.container,
        image: ref.image,
        usedBy: ref.usedBy
      }))
    }
  }
}

export function primaryContainerName(names: string[]): string {
  return names.map(normalizeContainerName)[0] ?? 'unknown'
}

export function containerIdsMatch(fullId: string, shortId: string): boolean {
  return fullId.startsWith(shortId)
}

export function findListedContainerById(listed: ListedContainer[], id: string): ListedContainer | undefined {
  return listed.find((container) => containerIdsMatch(container.Id, id) || container.Id === id)
}

export function findListedContainerByName(listed: ListedContainer[], name: string): ListedContainer | undefined {
  return listed.find((container) => containerNameMatches(container.Names, name))
}
