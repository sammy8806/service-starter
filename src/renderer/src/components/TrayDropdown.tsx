import { useServiceState } from '../hooks/useServiceState'
import { ProjectGroup } from './tray/ProjectGroup'
import { PortSummary } from './PortSummary'
import { isPortBound } from '../../../shared/port-state'

export function TrayDropdown(): React.JSX.Element {
  const { state, openTerminal, openEditor, openGitGui, killPort, openDashboard, startComponent, stopComponent } = useServiceState()

  const projects = Object.values(state.projects)
  const activePortNumbers = new Set<number>()
  const totalPorts = projects.reduce(
    (sum, p) =>
      sum + Object.values(p.components).reduce((s, c) => s + c.ports.length, 0),
    0
  )

  for (const project of projects) {
    for (const component of Object.values(project.components)) {
      for (const port of component.ports) {
        if (isPortBound(port)) {
          activePortNumbers.add(port.port)
        }
      }
    }
  }

  const activePorts = activePortNumbers.size

  return (
    <div className="w-[360px] max-h-[480px] flex flex-col bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-white/[0.08] shadow-2xl shadow-black/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Services
        </span>
        <button
          onClick={openDashboard}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Dashboard &rarr;
        </button>
      </div>

      {/* Projects list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
        {projects.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-[13px] text-zinc-500">No projects discovered</p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Add <span className="font-mono text-zinc-500">.service-starter.yml</span> to your
              projects
            </p>
          </div>
        ) : (
          projects.map((project) => (
            <ProjectGroup
              key={project.name}
              project={project}
              onOpenTerminal={openTerminal}
              onOpenEditor={openEditor}
              onOpenGitGui={openGitGui}
              onKillPort={killPort}
              onStartComponent={startComponent}
              onStopComponent={stopComponent}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <PortSummary
        totalPorts={totalPorts}
        activePorts={activePorts}
      />
    </div>
  )
}
