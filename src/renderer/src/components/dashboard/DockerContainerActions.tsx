import { useState } from 'react'
import type { DependencyStateView } from '../../context/AppContext'
import type { DockerContainerView } from '../../utils/dockerDisplay'
import { ActionButton } from './ui/ActionButton'
import { canStartDocker, canStopDocker, dockerContainerRef } from '../../utils/dependencyDisplay'
import { canStartContainer, canStopContainer } from '../../utils/dockerDisplay'

interface DockerContainerActionsProps {
  dep?: DependencyStateView
  container?: DockerContainerView
  compact?: boolean
}

export function DockerContainerActions({
  dep,
  container,
  compact = false
}: DockerContainerActionsProps): React.JSX.Element | null {
  const [busy, setBusy] = useState<'start' | 'stop' | null>(null)

  if (container) {
    const canStart = canStartContainer(container.state)
    const canStop = canStopContainer(container.state)
    if (!canStart && !canStop) return null

    const runById = async (action: 'start' | 'stop'): Promise<void> => {
      setBusy(action)
      try {
        const api =
          action === 'start' ? window.api.startDockerContainerById : window.api.stopDockerContainerById
        await api(container.id)
      } finally {
        setBusy(null)
      }
    }

    return (
      <div className={`flex shrink-0 items-center ${compact ? 'gap-1' : 'gap-2'}`}>
        {canStart && (
          <ActionButton variant="primary" disabled={busy !== null} onClick={() => void runById('start')}>
            {busy === 'start' ? 'Starting…' : 'Start'}
          </ActionButton>
        )}
        {canStop && (
          <ActionButton variant="danger" disabled={busy !== null} onClick={() => void runById('stop')}>
            {busy === 'stop' ? 'Stopping…' : 'Stop'}
          </ActionButton>
        )}
      </div>
    )
  }

  if (!dep) return null

  const ref = dockerContainerRef(dep)
  if (!ref || dep.docker?.state === 'unavailable') {
    return null
  }

  const canStart = canStartDocker(dep)
  const canStop = canStopDocker(dep)
  if (!canStart && !canStop) {
    return null
  }

  const run = async (action: 'start' | 'stop'): Promise<void> => {
    setBusy(action)
    try {
      const api = action === 'start' ? window.api.startDockerContainer : window.api.stopDockerContainer
      await api(ref.container, ref.image)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={`flex shrink-0 items-center ${compact ? 'gap-1' : 'gap-2'}`}>
      {canStart && (
        <ActionButton variant="primary" disabled={busy !== null} onClick={() => void run('start')}>
          {busy === 'start' ? 'Starting…' : 'Start'}
        </ActionButton>
      )}
      {canStop && (
        <ActionButton variant="danger" disabled={busy !== null} onClick={() => void run('stop')}>
          {busy === 'stop' ? 'Stopping…' : 'Stop'}
        </ActionButton>
      )}
    </div>
  )
}
