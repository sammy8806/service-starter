import { ComponentRow } from './ComponentRow'
import { ProjectStateView } from '../../context/AppContext'
import { ComponentRowData } from '../../utils/sortServices'
import { ContextMenuTrigger } from './ContextMenuTrigger'

interface ProjectGroupProps {
  project: ProjectStateView
  components: ComponentRowData[]
  expanded: boolean
  isFavorite: boolean
  runningCount: number
  totalCount: number
  selectedId: string | null
  now: number
  showStar?: boolean
  onToggleExpanded: (projectName: string) => void
  onToggleFavorite: (projectName: string) => void
  onStartComponent: (projectName: string, componentName: string) => void
  onStopComponent: (projectName: string, componentName: string) => void
  onShowProjectMenu: () => void
  onShowComponentMenu: (componentName: string) => void
}

export function ProjectGroup({
  project,
  components,
  expanded,
  isFavorite,
  runningCount,
  totalCount,
  selectedId,
  now,
  showStar = false,
  onToggleExpanded,
  onToggleFavorite,
  onStartComponent,
  onStopComponent,
  onShowProjectMenu,
  onShowComponentMenu
}: ProjectGroupProps): React.JSX.Element {
  const headerSelected = selectedId === project.name
  const dotColor = runningCount > 0 ? 'bg-emerald-400' : 'bg-zinc-600'

  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      <div
        className={`group flex items-center gap-2 px-3 py-1.5 transition-colors ${
          headerSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
        }`}
      >
        <button
          onClick={() => onToggleExpanded(project.name)}
          aria-label={project.name}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
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
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
          <span className="flex-1 text-[13.5px] font-medium text-zinc-200 text-left truncate">
            {project.name}
          </span>
        </button>

        {showStar && (
          <button
            aria-label={isFavorite ? `Unpin ${project.name}` : `Pin ${project.name}`}
            title={isFavorite ? 'Unpin project' : 'Pin project'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite(project.name)
            }}
            className={`p-1 rounded transition opacity-70 hover:opacity-100 hover:bg-white/10 ${
              isFavorite ? 'text-amber-300' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <svg
              className="w-3.5 h-3.5"
              fill={isFavorite ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.5l2.2 4.46 4.92.72-3.56 3.47.84 4.9-4.4-2.31-4.4 2.31.84-4.9-3.56-3.47 4.92-.72 2.2-4.46z"
              />
            </svg>
          </button>
        )}

        <ContextMenuTrigger onShow={onShowProjectMenu} label="More actions" />

        <span className="text-[11px] font-mono text-zinc-500 tabular-nums flex-shrink-0">
          {runningCount}/{totalCount}
        </span>
      </div>

      {expanded && (
        <div className="pb-1">
          {components.map(({ component }) => (
            <ComponentRow
              key={component.name}
              component={component}
              projectName={project.name}
              projectDir={project.directory}
              selected={selectedId === `${project.name}/${component.name}`}
              now={now}
              onStartComponent={onStartComponent}
              onStopComponent={onStopComponent}
              onShowContextMenu={() => onShowComponentMenu(component.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
