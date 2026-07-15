import type { ProjectStateView } from '../../context/AppContext'
import { StatusBadge } from '../StatusBadge'
import { DetailHeader } from './ui/DetailHeader'
import { Section } from './ui/Section'
import { ActionButton } from './ui/ActionButton'
import { EmptyState } from './ui/EmptyState'
import { DependencyRow } from './DependencyRow'
import { collectProjectDependencies } from '../../utils/dependencyDisplay'

interface ProjectDetailProps {
  project: ProjectStateView
  onStartProject: (projectName: string) => void
  onStopProject: (projectName: string) => void
  onSelectComponent: (componentName: string) => void
}

export function ProjectDetail({
  project,
  onStartProject,
  onStopProject,
  onSelectComponent
}: ProjectDetailProps): React.JSX.Element {
  const components = Object.values(project.components)
  const running = components.filter((c) => c.status === 'running').length
  const runningComponents = components.filter((c) => c.status === 'running')
  const dependencies = collectProjectDependencies(project)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DetailHeader
        title={project.name}
        subtitle={project.directory}
        actions={
          <>
            <span className="font-mono text-[12px] tabular-nums text-zinc-500">
              {running}/{components.length} running
            </span>
            <ActionButton variant="primary" onClick={() => onStartProject(project.name)}>
              Start all
            </ActionButton>
            <ActionButton variant="danger" onClick={() => onStopProject(project.name)}>
              Stop all
            </ActionButton>
          </>
        }
      />

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {dependencies.length > 0 && (
          <Section title="Project Dependencies">
            <div className="divide-y divide-white/[0.04] rounded-lg border border-white/[0.06]">
              {dependencies.map((dep, i) => (
                <DependencyRow key={`${dep.dependency.container ?? dep.dependency.name}-${i}`} dep={dep} />
              ))}
            </div>
          </Section>
        )}

        {runningComponents.length > 0 ? (
          <Section title="Running — open logs">
            <div className="divide-y divide-white/[0.04] rounded-lg border border-white/[0.06]">
              {runningComponents.map((comp) => (
                <button
                  key={comp.name}
                  type="button"
                  onClick={() => onSelectComponent(comp.name)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-white/[0.02]"
                >
                  <StatusBadge status={comp.status} size="md" />
                  <span className="font-medium text-zinc-300">{comp.name}</span>
                  {comp.ports[0] && (
                    <span className="font-mono text-[11px] text-zinc-600">:{comp.ports[0].port}</span>
                  )}
                  <span className="ml-auto text-[11px] text-zinc-500">View logs →</span>
                </button>
              ))}
            </div>
          </Section>
        ) : (
          <EmptyState
            title="No services running"
            description="Select a component in the sidebar to inspect logs, ports, dependencies, and environment."
          />
        )}
      </div>
    </div>
  )
}
