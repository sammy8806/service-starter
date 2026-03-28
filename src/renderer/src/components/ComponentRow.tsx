import { StatusBadge } from './StatusBadge'
import { ComponentStateView } from '../context/AppContext'

interface ComponentRowProps {
  component: ComponentStateView
  projectName: string
  projectDir: string
  onOpenEditor: (dir: string, editor?: string) => void
  onKillPort: (port: number) => void
  onStartComponent: (projectName: string, componentName: string) => void
  onStopComponent: (projectName: string, componentName: string) => void
}

export function ComponentRow({
  component,
  projectName,
  projectDir,
  onOpenEditor,
  onKillPort,
  onStartComponent,
  onStopComponent
}: ComponentRowProps): React.JSX.Element {
  const mainPort = component.ports[0]
  const editorDir = component.codeDir ?? component.workDir ?? projectDir

  return (
    <div className="group flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.04] transition-colors">
      <StatusBadge status={component.status} />
      {component.processOrigin === 'managed' && component.status === 'running' && (
        <span className="text-[9px] text-emerald-500/60 font-mono uppercase tracking-wider">m</span>
      )}

      <span className="flex-1 text-[13px] text-zinc-300 truncate tracking-tight">
        {component.name}
      </span>

      {/* Hover actions - left of port so layout doesn't shift */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {component.status === 'stopped' ? (
          <ActionButton
            icon="play"
            title="Start"
            onClick={() => onStartComponent(projectName, component.name)}
          />
        ) : component.processOrigin === 'managed' ? (
          <ActionButton
            icon="stop"
            title="Stop"
            onClick={() => onStopComponent(projectName, component.name)}
            danger
          />
        ) : null}
        <ActionButton
          icon="code"
          title="Open in Editor"
          onClick={() => onOpenEditor(editorDir, component.editor)}
        />
        {mainPort && mainPort.status === 'in-use' && component.processOrigin === 'external' && (
          <ActionButton
            icon="kill"
            title={`Kill :${mainPort.port}`}
            onClick={() => onKillPort(mainPort.port)}
            danger
          />
        )}
      </div>

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
    </div>
  )
}

function ActionButton({
  icon,
  title,
  onClick,
  danger = false
}: {
  icon: 'terminal' | 'code' | 'kill' | 'play' | 'stop'
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
    ),
    play: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
    ),
    stop: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
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
