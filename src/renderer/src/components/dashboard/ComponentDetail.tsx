import { useState } from 'react'
import type { ComponentStateView } from '../../context/AppContext'
import { StatusBadge } from '../StatusBadge'
import { formatUptime } from '../../utils/formatUptime'
import { LogsTab } from './LogsTab'
import { PortsTab } from './PortsTab'
import { DepsTab } from './DepsTab'
import { EnvTab } from './EnvTab'

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
  const pid = component.ports.find((p) => typeof p.pid === 'number')?.pid
  const port = component.ports[0]?.port
  const isManaged = component.processOrigin === 'managed'
  const isRunning = component.status === 'running'

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <StatusBadge status={component.status} size="md" />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-zinc-100">{component.name}</div>
          <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
            {port ? `:${port}` : ''}
            {component.startedAt ? ` · ${formatUptime(component.startedAt, Date.now())}` : ''}
            {pid ? ` · pid ${pid}` : ''}
            {` · ${component.processOrigin}`}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isManaged && isRunning && (
            <button
              onClick={() => onRestart(projectName, component.name)}
              className="px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              Restart
            </button>
          )}
          {isRunning && isManaged ? (
            <button
              onClick={() => onStop(projectName, component.name)}
              className="px-3 py-1.5 text-[12px] text-red-400/80 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            >
              Stop
            </button>
          ) : component.processOrigin === 'none' ? (
            <button
              onClick={() => onStart(projectName, component.name)}
              className="px-3 py-1.5 text-[12px] text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
            >
              Start
            </button>
          ) : null}
        </div>
      </div>

      {/* Tab bar */}
      <nav className="flex gap-0 px-5 border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-[13px] font-medium transition-colors relative ${
              tab === t.id ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-zinc-100 rounded-full" />
            )}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="flex flex-1 flex-col min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
        {tab === 'logs' && (
          <LogsTab
            projectName={projectName}
            componentName={component.name}
            processOrigin={component.processOrigin}
            directory={directory}
          />
        )}
        {tab === 'ports' && <PortsTab component={component} />}
        {tab === 'deps' && <DepsTab component={component} />}
        {tab === 'env' && <EnvTab projectName={projectName} componentName={component.name} />}
      </div>
    </div>
  )
}
