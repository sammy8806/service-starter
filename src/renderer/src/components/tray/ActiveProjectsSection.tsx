import { ProjectRow } from '../../utils/sortServices'
import { ProjectGroup } from './ProjectGroup'

interface ActiveProjectsSectionProps {
  projects: ProjectRow[]
  selectedId: string | null
  now: number
  onToggleExpanded: (projectName: string) => void
  onToggleFavorite: (projectName: string) => void
  onStartComponent: (projectName: string, componentName: string) => void
  onStopComponent: (projectName: string, componentName: string) => void
  onOpenLogs: (projectName: string, componentName: string) => void
  onShowProjectMenu: (project: ProjectRow) => void
  onShowComponentMenu: (projectName: string, componentName: string) => void
  collapsedProjects: Set<string>
  searching: boolean
}

export function ActiveProjectsSection({
  projects,
  selectedId,
  now,
  onToggleExpanded,
  onToggleFavorite,
  onStartComponent,
  onStopComponent,
  onOpenLogs,
  onShowProjectMenu,
  onShowComponentMenu,
  collapsedProjects,
  searching
}: ActiveProjectsSectionProps): React.JSX.Element | null {
  if (projects.length === 0) return null

  return (
    <div>
      <div className="sticky top-0 z-10 px-3 py-1 bg-zinc-900/60 backdrop-blur text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        ▶ Active Projects ({projects.length})
      </div>
      {projects.map((row) => (
        <ProjectGroup
          key={row.project.name}
          project={row.project}
          components={row.components}
          expanded={searching || !collapsedProjects.has(row.project.name)}
          isFavorite={row.isFavorite}
          runningCount={row.runningCount}
          totalCount={row.totalCount}
          selectedId={selectedId}
          now={now}
          onToggleExpanded={onToggleExpanded}
          onToggleFavorite={onToggleFavorite}
          onStartComponent={onStartComponent}
          onStopComponent={onStopComponent}
          onOpenLogs={onOpenLogs}
          onShowProjectMenu={() => onShowProjectMenu(row)}
          onShowComponentMenu={(componentName) => onShowComponentMenu(row.project.name, componentName)}
        />
      ))}
    </div>
  )
}
