import type { DependencyStateView } from '../../context/AppContext'

export function canStartDocker(dep: DependencyStateView): boolean {
  return dep.dependency.type === 'docker' && dep.docker?.state === 'stopped'
}

export function canStopDocker(dep: DependencyStateView): boolean {
  return dep.dependency.type === 'docker' && dep.docker?.state === 'running'
}

export function dockerContainerRef(dep: DependencyStateView): { container: string; image?: string } | null {
  if (dep.dependency.type !== 'docker' || !dep.dependency.container) return null
  return {
    container: dep.dependency.container,
    image: dep.dependency.image
  }
}

export function dependencyLabel(dep: DependencyStateView): string {
  return dep.dependency.name ?? dep.dependency.container ?? 'unknown'
}

export function dependencyStatusLabel(dep: DependencyStateView): string {
  if (dep.dependency.type === 'docker' && dep.docker) {
    switch (dep.docker.state) {
      case 'running':
        return 'Running'
      case 'stopped':
        return 'Stopped'
      case 'not_found':
        return 'Not found'
      case 'unavailable':
        return 'Docker unavailable'
    }
  }

  switch (dep.health) {
    case 'healthy':
      return 'Healthy'
    case 'unhealthy':
      return 'Unhealthy'
    default:
      return 'Unknown'
  }
}

export function dependencyStatusTone(
  dep: DependencyStateView
): 'healthy' | 'unhealthy' | 'unknown' | 'warning' {
  if (dep.dependency.type === 'docker' && dep.docker) {
    if (dep.docker.state === 'running') return 'healthy'
    if (dep.docker.state === 'unavailable') return 'unknown'
    if (dep.docker.state === 'not_found') return 'warning'
    return 'unhealthy'
  }

  if (dep.health === 'healthy') return 'healthy'
  if (dep.health === 'unhealthy') return 'unhealthy'
  return 'unknown'
}

export function dependencyBadgeStatus(
  dep: DependencyStateView
): 'healthy' | 'unhealthy' | 'unknown' | 'warning' | 'stopped' {
  const tone = dependencyStatusTone(dep)
  if (tone === 'warning') return 'warning'
  if (tone === 'healthy') return 'healthy'
  if (tone === 'unhealthy') return 'unhealthy'
  return 'unknown'
}

export function dependencyDetailLine(dep: DependencyStateView): string | undefined {
  if (dep.docker?.statusText) return dep.docker.statusText
  if (dep.docker?.matchedName && dep.docker.matchedName !== dep.dependency.container) {
    return `Matched ${dep.docker.matchedName}`
  }
  if (dep.docker?.image) return dep.docker.image
  return dep.error
}

export interface DockerOverviewRow {
  key: string
  container: string
  project: string
  scope: 'project' | 'component'
  component?: string
  dep: DependencyStateView
}

export function collectDockerDependencies(state: {
  projects: Record<string, { name: string; dependencies: DependencyStateView[]; components: Record<string, { dependencies: DependencyStateView[] }> }>
}): DockerOverviewRow[] {
  const rows: DockerOverviewRow[] = []
  const seen = new Set<string>()

  for (const project of Object.values(state.projects)) {
    for (const dep of project.dependencies) {
      if (dep.dependency.type !== 'docker' || !dep.dependency.container) continue
      const key = `project:${project.name}:${dep.dependency.container}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({
        key,
        container: dep.dependency.container,
        project: project.name,
        scope: 'project',
        dep
      })
    }

    for (const [componentName, component] of Object.entries(project.components)) {
      for (const dep of component.dependencies) {
        if (dep.dependency.type !== 'docker' || !dep.dependency.container) continue
        const key = `component:${project.name}/${componentName}:${dep.dependency.container}`
        if (seen.has(key)) continue
        seen.add(key)
        rows.push({
          key,
          container: dep.dependency.container,
          project: project.name,
          scope: 'component',
          component: componentName,
          dep
        })
      }
    }
  }

  return rows.sort((a, b) => a.container.localeCompare(b.container))
}
