import type { ProjectStateView } from '../../context/AppContext'
import { StatusBadge } from '../StatusBadge'

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
  const aggregatePorts = components.flatMap((c) => c.ports)

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-zinc-100">{project.name}</div>
          <div className="text-[11px] font-mono text-zinc-500 mt-0.5">{project.directory}</div>
        </div>
        <span className="text-[12px] font-mono tabular-nums text-zinc-500 ml-3">
          {running} / {components.length} running
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onStartProject(project.name)}
            className="px-3 py-1.5 text-[12px] text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
          >
            Start all
          </button>
          <button
            onClick={() => onStopProject(project.name)}
            className="px-3 py-1.5 text-[12px] text-red-400/80 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            Stop all
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
            Components
          </h3>
          <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]">
            {components.map((comp) => (
              <button
                key={comp.name}
                onClick={() => onSelectComponent(comp.name)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-left hover:bg-white/[0.02] transition-colors"
              >
                <StatusBadge status={comp.status} size="md" />
                <span className="text-zinc-300 font-medium">{comp.name}</span>
                {comp.ports[0] && (
                  <span className="font-mono text-[11px] text-zinc-600">:{comp.ports[0].port}</span>
                )}
                <span className="ml-auto text-[11px] text-zinc-500">View logs →</span>
              </button>
            ))}
          </div>
        </section>

        {aggregatePorts.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
              Ports
            </h3>
            <div className="flex flex-wrap gap-2">
              {aggregatePorts.map((port, i) => (
                <span
                  key={`${port.port}-${i}`}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                    port.status === 'conflict'
                      ? 'bg-amber-500/10 text-amber-400'
                      : port.status === 'in-use'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-zinc-700/50 text-zinc-400'
                  }`}
                >
                  :{port.port} {port.label}
                </span>
              ))}
            </div>
          </section>
        )}

        {project.dependencies.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
              Dependencies
            </h3>
            <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]">
              {project.dependencies.map((dep, i) => {
                const name = dep.dependency.name ?? dep.dependency.container ?? 'unknown'
                return (
                  <div key={`${name}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                    <StatusBadge status={dep.health} size="md" />
                    <span className="text-zinc-300">{name}</span>
                    <span className="ml-auto text-[12px] text-zinc-500">{dep.health}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
