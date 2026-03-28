import { useState } from 'react'
import { ComponentRow } from './ComponentRow'
import { ProjectStateView } from '../context/AppContext'

interface ProjectGroupProps {
  project: ProjectStateView
  onOpenTerminal: (dir: string) => void
  onOpenEditor: (dir: string, editor?: string) => void
  onOpenGitGui: (dir: string) => void
  onKillPort: (port: number) => void
}

export function ProjectGroup({
  project,
  onOpenTerminal,
  onOpenEditor,
  onOpenGitGui,
  onKillPort
}: ProjectGroupProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const components = Object.values(project.components)
  const runningCount = components.filter((c) => c.status === 'running').length
  const hasWarning = components.some((c) => c.status === 'warning')

  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      {/* Project header */}
      <div className="group flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] transition-colors">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          {/* Expand/collapse chevron */}
          <svg
            className={`w-3 h-3 text-zinc-500 transition-transform duration-150 flex-shrink-0 ${
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
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
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

        {/* Project-level action buttons */}
        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOpenTerminal(project.directory)
            }}
            title="Open in Terminal"
            className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3"
              />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOpenGitGui(project.directory)
            }}
            title="Open in Git GUI"
            className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Components list */}
      {expanded && (
        <div className="pb-1">
          {components.map((comp) => (
            <ComponentRow
              key={comp.name}
              component={comp}
              projectDir={project.directory}
              onOpenEditor={onOpenEditor}
              onKillPort={onKillPort}
            />
          ))}
        </div>
      )}
    </div>
  )
}
