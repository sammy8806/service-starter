import { useState } from 'react'
import { ComponentRow } from './ComponentRow'
import { ProjectStateView } from '../context/AppContext'

interface ProjectGroupProps {
  project: ProjectStateView
  onOpenTerminal: (dir: string) => void
  onOpenEditor: (dir: string) => void
  onKillPort: (port: number) => void
}

export function ProjectGroup({
  project,
  onOpenTerminal,
  onOpenEditor,
  onKillPort
}: ProjectGroupProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const components = Object.values(project.components)
  const runningCount = components.filter((c) => c.status === 'running').length
  const hasWarning = components.some((c) => c.status === 'warning')

  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      {/* Project header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] transition-colors"
      >
        {/* Expand/collapse chevron */}
        <svg
          className={`w-3 h-3 text-zinc-500 transition-transform duration-150 ${
            expanded ? 'rotate-90' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>

        {/* Running indicator */}
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            hasWarning ? 'bg-amber-400' : runningCount > 0 ? 'bg-emerald-400' : 'bg-zinc-600'
          }`}
        />

        {/* Project name */}
        <span className="flex-1 text-[13px] font-medium text-zinc-200 text-left truncate">
          {project.name}
        </span>

        {/* Component count */}
        <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
          {runningCount}/{components.length}
        </span>
      </button>

      {/* Components list */}
      {expanded && (
        <div className="pb-1">
          {components.map((comp) => (
            <ComponentRow
              key={comp.name}
              component={comp}
              projectDir={project.directory}
              onOpenTerminal={onOpenTerminal}
              onOpenEditor={onOpenEditor}
              onKillPort={onKillPort}
            />
          ))}
        </div>
      )}
    </div>
  )
}
