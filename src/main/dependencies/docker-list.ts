import type { ListedContainer } from './docker-matching'
import { normalizeContainerName } from './docker-matching'

export interface DockerContainerView {
  id: string
  name: string
  names: string[]
  image: string
  state: string
  status: string
  usedBy: string[]
}

export function mapListedContainer(container: ListedContainer, usedBy: string[] = []): DockerContainerView {
  const names = container.Names.map(normalizeContainerName)
  return {
    id: container.Id.slice(0, 12),
    name: names[0] ?? container.Id.slice(0, 12),
    names,
    image: container.Image,
    state: container.State,
    status: container.Status,
    usedBy
  }
}

export function dockerStateLabel(state: string): string {
  if (state === 'running') return 'running'
  return state
}

export function dockerStateTone(state: string): 'healthy' | 'unhealthy' | 'unknown' {
  if (state === 'running') return 'healthy'
  if (state === 'exited' || state === 'stopped' || state === 'dead') return 'unhealthy'
  return 'unknown'
}

export function canStartContainer(state: string): boolean {
  return state !== 'running' && state !== 'restarting'
}

export function canStopContainer(state: string): boolean {
  return state === 'running' || state === 'restarting'
}
