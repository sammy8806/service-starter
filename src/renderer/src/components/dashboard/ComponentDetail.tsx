import { useState } from 'react'
import type { ComponentStateView } from '../../context/AppContext'
import { StatusBadge } from '../StatusBadge'
import { formatUptime } from '../../utils/formatUptime'
import { LogsTab } from './LogsTab'
import { PortsTab } from './PortsTab'
import { DepsTab } from './DepsTab'
import { EnvTab } from './EnvTab'
import { DetailHeader } from './ui/DetailHeader'
import { TabBar } from './ui/TabBar'
import { ActionButton } from './ui/ActionButton'

type DetailTab = 'logs' | 'ports' | 'deps' | 'env'

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'logs', label: 'Logs' },
  { id: 'ports', label: 'Ports' },
  { id: 'deps', label: 'Deps' },
  { id: 'env', label: 'Env' }
]

interface ComponentDetailProps {
  projectName: string
  directory: string
  component: ComponentStateView
  onStart: (projectName: string, componentName: string) => void
  onStop: (projectName: string, componentName: string) => void
  onRestart: (projectName: string, componentName: string) => void
}

export function ComponentDetail({
  projectName,
  directory,
  component,
  onStart,
  onStop,
  onRestart
}: ComponentDetailProps): React.JSX.Element {
  const [tab, setTab] = useState<DetailTab>('logs')
  const pid = component.pid ?? component.ports.find((p) => typeof p.pid === 'number')?.pid
  const port = component.ports[0]?.port
  const isManaged = component.processOrigin === 'managed'
  const isRunning = component.status === 'running'
  const isStartable = component.processOrigin === 'none'

  const subtitle = [
    port ? `:${port}` : null,
    component.startedAt ? formatUptime(component.startedAt) : null,
    pid ? `pid ${pid}` : null,
    component.processOrigin !== 'none' ? component.processOrigin : null
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DetailHeader
        leading={<StatusBadge status={component.status} size="md" />}
        title={component.name}
        subtitle={subtitle}
        actions={
          <>
            {isManaged && isRunning && (
              <ActionButton onClick={() => onRestart(projectName, component.name)}>Restart</ActionButton>
            )}
            {isRunning && isManaged ? (
              <ActionButton variant="danger" onClick={() => onStop(projectName, component.name)}>
                Stop
              </ActionButton>
            ) : isStartable ? (
              <ActionButton variant="primary" onClick={() => onStart(projectName, component.name)}>
                Start
              </ActionButton>
            ) : null}
          </>
        }
      />

      <TabBar tabs={TABS} active={tab} onChange={setTab} ariaLabel="Component detail" />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === 'logs' && (
          <LogsTab
            projectName={projectName}
            componentName={component.name}
            processOrigin={component.processOrigin}
            directory={directory}
            hasServiceLog={component.hasServiceLog}
          />
        )}
        {tab === 'ports' && (
          <div className="flex-1 overflow-y-auto">
            <PortsTab component={component} />
          </div>
        )}
        {tab === 'deps' && (
          <div className="flex-1 overflow-y-auto">
            <DepsTab component={component} />
          </div>
        )}
        {tab === 'env' && (
          <div className="flex-1 overflow-y-auto">
            <EnvTab projectName={projectName} componentName={component.name} />
          </div>
        )}
      </div>
    </div>
  )
}
