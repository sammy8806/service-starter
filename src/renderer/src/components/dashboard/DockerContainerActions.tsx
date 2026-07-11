import { useState } from 'react'
import type { DependencyStateView } from '../../context/AppContext'
import { ActionButton } from './ui/ActionButton'
import { canStartDocker, canStopDocker, dockerContainerRef } from '../../utils/dependencyDisplay'

interface DockerContainerActionsProps {
  dep: DependencyStateView
  compact?: boolean
}

export function DockerContainerActions({
  dep,
  compact = false
}: DockerContainerActionsProps): React.JSX.Element | null {
  const ref = dockerContainerRef(dep)
  const [busy, setBusy] = useState<'start' | 'stop' | null>(null)

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
        <ActionButton
          variant="primary"
          disabled={busy !== null}
          onClick={() => {
            void run('start')
          }}
        >
          {busy === 'start' ? 'Starting…' : 'Start'}
        </ActionButton>
      )}
      {canStop && (
        <ActionButton
          variant="danger"
          disabled={busy !== null}
          onClick={() => {
            void run('stop')
          }}
        >
          {busy === 'stop' ? 'Stopping…' : 'Stop'}
        </ActionButton>
      )}
    </div>
  )
}
