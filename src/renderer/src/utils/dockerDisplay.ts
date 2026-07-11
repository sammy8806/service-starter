import type { DockerContainerView, DockerSnapshotView } from '../context/AppContext'

export function dockerStateTone(state: string): 'healthy' | 'unhealthy' | 'unknown' {
  if (state === 'running') return 'healthy'
  if (state === 'exited' || state === 'stopped' || state === 'dead') return 'unhealthy'
  return 'unknown'
}

const TONE_CLASS = {
  healthy: 'text-emerald-400',
  unhealthy: 'text-red-400',
  unknown: 'text-zinc-500',
  warning: 'text-amber-400'
} as const

export function dockerStateClass(state: string): string {
  return TONE_CLASS[dockerStateTone(state)]
}

export function hasDockerContent(docker: DockerSnapshotView): boolean {
  return docker.containers.length > 0 || docker.missing.length > 0 || !docker.available
}

export function formatUsedBy(usedBy: string[]): string {
  return usedBy.length > 0 ? usedBy.join(', ') : '—'
}

export function canStartContainer(state: string): boolean {
  return state !== 'running' && state !== 'restarting'
}

export function canStopContainer(state: string): boolean {
  return state === 'running' || state === 'restarting'
}

export function containerActionTarget(container: DockerContainerView): string {
  return container.id
}

export { type DockerContainerView }
