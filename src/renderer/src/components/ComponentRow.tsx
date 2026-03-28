import { StatusBadge } from './StatusBadge'
import { ComponentStateView } from '../context/AppContext'

interface ComponentRowProps {
  component: ComponentStateView
  projectDir: string
  onOpenTerminal: (dir: string) => void
  onOpenEditor: (dir: string) => void
  onKillPort: (port: number) => void
}

export function ComponentRow({
  component,
  projectDir,
  onOpenTerminal,
  onOpenEditor,
  onKillPort
}: ComponentRowProps): React.JSX.Element {
  const mainPort = component.ports[0]

  return (
    <div className="group flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.04] transition-colors">
      <StatusBadge status={component.status} />

      <span className="flex-1 text-[13px] text-zinc-300 truncate tracking-tight">
        {component.name}
      </span>

      {/* Port display */}
      {mainPort && (
        <span
          className={`font-mono text-[11px] tabular-nums ${
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

      {/* Hover actions */}
      <div className="hidden group-hover:flex items-center gap-0.5 -mr-1">
        <ActionButton
          icon="terminal"
          title="Open in Terminal"
          onClick={() => onOpenTerminal(projectDir)}
        />
        <ActionButton
          icon="code"
          title="Open in Editor"
          onClick={() => onOpenEditor(projectDir)}
        />
        {mainPort && mainPort.status === 'in-use' && (
          <ActionButton
            icon="kill"
            title={`Kill :${mainPort.port}`}
            onClick={() => onKillPort(mainPort.port)}
            danger
          />
        )}
      </div>
    </div>
  )
}

function ActionButton({
  icon,
  title,
  onClick,
  danger = false
}: {
  icon: 'terminal' | 'code' | 'kill'
  title: string
  onClick: () => void
  danger?: boolean
}): React.JSX.Element {
  const iconMap = {
    terminal: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3"
      />
    ),
    code: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
      />
    ),
    kill: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    )
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={title}
      className={`p-1 rounded transition-colors ${
        danger
          ? 'hover:bg-red-500/20 text-zinc-500 hover:text-red-400'
          : 'hover:bg-white/10 text-zinc-500 hover:text-zinc-300'
      }`}
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        {iconMap[icon]}
      </svg>
    </button>
  )
}
