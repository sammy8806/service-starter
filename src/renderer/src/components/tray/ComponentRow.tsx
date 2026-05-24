import { StatusBadge } from '../StatusBadge'
import { ComponentStateView } from '../../context/AppContext'
import { findBoundPort, hasBoundPort } from '../../../../shared/port-state'
import { formatUptime } from '../../utils/formatUptime'
import { ContextMenuTrigger } from './ContextMenuTrigger'

interface ComponentRowProps {
  component: ComponentStateView
  projectName: string
  projectDir: string
  selected?: boolean
  now?: number
  onStartComponent: (projectName: string, componentName: string) => void
  onStopComponent: (projectName: string, componentName: string) => void
  onShowContextMenu: () => void
  onHover?: () => void
}

export function ComponentRow({
  component,
  projectName,
  projectDir: _projectDir,
  selected = false,
  now,
  onStartComponent,
  onStopComponent,
  onShowContextMenu,
  onHover
}: ComponentRowProps): React.JSX.Element {
  const mainPort = component.ports[0]
  const canStart = component.processOrigin === 'none' && !hasBoundPort(component.ports)
  const killablePort =
    component.processOrigin === 'external' ? findBoundPort(component.ports) : undefined
  const uptime = formatUptime(component.startedAt, now)
  const accent =
    component.status === 'warning'
      ? 'border-amber-400'
      : component.status === 'running'
        ? 'border-emerald-400'
        : 'border-transparent'

  return (
    <div
      onMouseMove={onHover}
      className={`group flex items-center gap-2 px-3 py-2 border-l transition-colors ${accent} ${
        selected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
      }`}
    >
      <StatusBadge status={component.status} />

      <span className="flex-1 min-w-0 text-[13.5px] text-zinc-300 truncate tracking-tight">
        {component.name}
      </span>

      {mainPort && (
        <span
          className={`font-mono text-[11px] tabular-nums flex-shrink-0 ${
            mainPort.status === 'conflict'
              ? 'text-amber-400'
              : mainPort.status === 'in-use'
                ? 'text-emerald-400'
                : 'text-zinc-500'
          }`}
        >
          :{mainPort.port}
        </span>
      )}

      {component.processOrigin === 'managed' && component.status === 'running' && (
        <span className="font-mono text-[11px] tabular-nums text-zinc-500 w-12 text-right flex-shrink-0">
          {uptime}
        </span>
      )}

      <div className="flex items-center gap-0.5 flex-shrink-0">
        {canStart ? (
          <RowAction icon="play" title="Start" onClick={() => onStartComponent(projectName, component.name)} />
        ) : component.processOrigin === 'managed' ? (
          <RowAction icon="stop" title="Stop" danger onClick={() => onStopComponent(projectName, component.name)} />
        ) : killablePort ? (
          <RowAction icon="kill" title={`Kill :${killablePort.port}`} danger onClick={() => onShowContextMenu()} />
        ) : null}
        <ContextMenuTrigger onShow={onShowContextMenu} label={`More actions for ${component.name}`} />
      </div>
    </div>
  )
}

function RowAction({
  icon,
  title,
  onClick,
  danger = false
}: {
  icon: 'kill' | 'play' | 'stop'
  title: string
  onClick: () => void
  danger?: boolean
}): React.JSX.Element {
  const iconMap = {
    kill: <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
    play: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
      />
    ),
    stop: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
      />
    )
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={title}
      aria-label={title}
      className={`p-1 rounded opacity-70 hover:opacity-100 transition ${
        danger
          ? 'hover:bg-red-500/20 text-zinc-500 hover:text-red-400'
          : 'hover:bg-white/10 text-zinc-500 hover:text-zinc-300'
      }`}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        {iconMap[icon]}
      </svg>
    </button>
  )
}
