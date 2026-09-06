import type { KeyboardEvent } from 'react'
import { useAppState } from '../../context/AppContext'
import { formatUptime } from '../../utils/formatUptime'
import { LogsTab } from '../dashboard/LogsTab'

interface CommandLogViewProps {
  projectName: string
  componentName: string
}

export function CommandLogView({
  projectName,
  componentName
}: CommandLogViewProps): React.JSX.Element {
  const { state } = useAppState()
  const project = state.projects[projectName]
  const component = project?.components[componentName]

  if (!project || !component) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-[12px] text-zinc-500">
        Loading command output…
      </div>
    )
  }

  const isRunning = component.processOrigin === 'managed' && component.status === 'running'
  const statusLabel = isRunning ? 'RUNNING' : component.hasServiceLog ? 'FINISHED' : 'READY'
  const statusClass = isRunning ? 'text-emerald-300' : 'text-zinc-500'
  const uptime = isRunning ? formatUptime(component.startedAt) : undefined

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      window.api.closeCommandLog()
    }
  }

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden rounded-xl border border-white/[0.1] bg-zinc-950 text-zinc-100 shadow-2xl shadow-black/50 outline-none"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] bg-zinc-900/90 px-4 py-3">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${isRunning ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)]' : 'bg-zinc-600'}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate text-[13px] font-medium tracking-tight text-zinc-200">
              {component.name}
            </h1>
            <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-600">
              command
            </span>
          </div>
          <p className="truncate font-mono text-[10px] text-zinc-600">{project.name}</p>
        </div>
        <span className={`font-mono text-[9px] tracking-[0.14em] ${statusClass}`}>
          {statusLabel}
          {uptime ? ` · ${uptime}` : ''}
        </span>
        <button
          type="button"
          onClick={() => window.api.closeCommandLog()}
          aria-label="Close command log"
          title="Close"
          className="ml-1 rounded p-1 text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <LogsTab
        projectName={projectName}
        componentName={componentName}
        processOrigin={component.processOrigin}
        directory={project.directory}
        hasServiceLog={component.hasServiceLog}
        minimal
      />
    </div>
  )
}
