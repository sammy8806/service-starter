import { useState } from 'react'
import { useAppState, ProjectStateView, ComponentStateView } from '../../context/AppContext'
import { StatusBadge } from '../StatusBadge'
import { LogViewer } from './LogViewer'
import { findBoundPort, hasBoundPort } from '../../../../shared/port-state'

export function ProjectsTab(): React.JSX.Element {
  const { state, openTerminal, openEditor, openGitGui, killPort, startComponent, stopComponent, startProject, stopProject } = useAppState()
  const projects = Object.values(state.projects)
  const [activeLog, setActiveLog] = useState<{ projectName: string; componentName: string } | null>(null)

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        </div>
        <p className="text-[14px] text-zinc-400 font-medium">No projects discovered</p>
        <p className="text-[12px] text-zinc-600 mt-1 max-w-xs">
          Add a <code className="text-zinc-500 bg-zinc-800 px-1 py-0.5 rounded text-[11px] font-mono">.service-starter.yml</code> manifest
          to your project directories to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="p-5 space-y-3 flex-1">
        {projects.map((project) => (
          <ProjectCard
            key={project.name}
            project={project}
            onOpenTerminal={openTerminal}
            onOpenEditor={openEditor}
            onOpenGitGui={openGitGui}
            onKillPort={killPort}
            onStartProject={startProject}
            onStopProject={stopProject}
            onStartComponent={startComponent}
            onStopComponent={stopComponent}
            onViewLog={(pn, cn) => setActiveLog({ projectName: pn, componentName: cn })}
          />
        ))}
      </div>

      {activeLog && (
        <LogViewer
          projectName={activeLog.projectName}
          componentName={activeLog.componentName}
          onClose={() => setActiveLog(null)}
        />
      )}
    </div>
  )
}

function ProjectCard({
  project,
  onOpenTerminal,
  onOpenEditor,
  onOpenGitGui,
  onKillPort,
  onStartProject,
  onStopProject,
  onStartComponent,
  onStopComponent,
  onViewLog
}: {
  project: ProjectStateView
  onOpenTerminal: (dir: string) => void
  onOpenEditor: (dir: string) => void
  onOpenGitGui: (dir: string) => void
  onKillPort: (port: number) => Promise<boolean>
  onStartProject: (projectName: string) => Promise<unknown>
  onStopProject: (projectName: string) => Promise<unknown>
  onStartComponent: (projectName: string, componentName: string) => Promise<unknown>
  onStopComponent: (projectName: string, componentName: string) => Promise<boolean>
  onViewLog: (projectName: string, componentName: string) => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const components = Object.values(project.components)
  const runningCount = components.filter((c) => c.status === 'running').length

  return (
    <div className="rounded-lg border border-white/[0.06] bg-zinc-800/50 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <svg
            className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>

          <div className="flex-1 text-left min-w-0">
            <div className="text-[14px] font-medium text-zinc-200">{project.name}</div>
            <div className="text-[11px] font-mono text-zinc-600 mt-0.5 truncate">{project.directory}</div>
          </div>

          <span className="text-[12px] font-mono tabular-nums text-zinc-500">
            {runningCount}/{components.length}
          </span>
        </button>

        <div className="flex items-center gap-1">
          {runningCount < components.length && (
            <button
              onClick={() => onStartProject(project.name)}
              className="px-2 py-1 text-[11px] text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors"
              title="Start All"
            >
              Start All
            </button>
          )}
          {runningCount > 0 && (
            <button
              onClick={() => onStopProject(project.name)}
              className="px-2 py-1 text-[11px] text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
              title="Stop All"
            >
              Stop All
            </button>
          )}
        </div>

        <button
          onClick={() => onOpenGitGui(project.directory)}
          className="px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded transition-colors flex-shrink-0"
          title="Open in Git GUI"
        >
          Git
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/[0.04]">
          {components.map((comp) => (
            <ComponentDetail
              key={comp.name}
              component={comp}
              projectName={project.name}
              projectDir={project.directory}
              onOpenTerminal={onOpenTerminal}
              onOpenEditor={onOpenEditor}
              onKillPort={onKillPort}
              onStartComponent={onStartComponent}
              onStopComponent={onStopComponent}
              onViewLog={onViewLog}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ComponentDetail({
  component,
  projectName,
  projectDir,
  onOpenTerminal,
  onOpenEditor,
  onKillPort,
  onStartComponent,
  onStopComponent,
  onViewLog
}: {
  component: ComponentStateView
  projectName: string
  projectDir: string
  onOpenTerminal: (dir: string) => void
  onOpenEditor: (dir: string) => void
  onKillPort: (port: number) => Promise<boolean>
  onStartComponent: (projectName: string, componentName: string) => Promise<unknown>
  onStopComponent: (projectName: string, componentName: string) => Promise<boolean>
  onViewLog?: (projectName: string, componentName: string) => void
}): React.JSX.Element {
  const canStart = component.processOrigin === 'none' && !hasBoundPort(component.ports)
  const killablePort = component.processOrigin === 'external' ? findBoundPort(component.ports) : undefined

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] border-b border-white/[0.03] last:border-b-0">
      <StatusBadge status={component.status} size="md" />

      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-zinc-300 font-medium">
          {component.name}
          {component.processOrigin === 'managed' && component.status !== 'stopped' && (
            <span className="ml-1.5 text-[9px] font-mono uppercase tracking-wider text-emerald-500/50">managed</span>
          )}
          {component.processOrigin === 'external' && component.status !== 'stopped' && (
            <span className="ml-1.5 text-[9px] font-mono uppercase tracking-wider text-zinc-500">external</span>
          )}
        </div>
        <div className="flex gap-2 mt-0.5">
          {component.ports.map((port) => (
            <span
              key={port.port}
              className={`text-[11px] font-mono tabular-nums ${
                port.status === 'conflict' ? 'text-amber-400' :
                port.status === 'in-use' ? 'text-emerald-400' : 'text-zinc-600'
              }`}
            >
              :{port.port} <span className="text-zinc-600">{port.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {canStart ? (
          <button
            onClick={() => onStartComponent(projectName, component.name)}
            className="px-2 py-1 text-[11px] text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors"
          >
            Start
          </button>
        ) : component.processOrigin === 'managed' ? (
          <button
            onClick={() => onStopComponent(projectName, component.name)}
            className="px-2 py-1 text-[11px] text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
          >
            Stop
          </button>
        ) : killablePort ? (
          <button
            onClick={() => onKillPort(killablePort.port)}
            className="px-2 py-1 text-[11px] text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
          >
            Kill
          </button>
        ) : null}
        {component.status !== 'stopped' && onViewLog && (
          <button
            onClick={() => onViewLog(projectName, component.name)}
            className="px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded transition-colors"
          >
            Logs
          </button>
        )}
        <button
          onClick={() => onOpenTerminal(projectDir)}
          className="px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded transition-colors"
          title="Open in Terminal"
        >
          Terminal
        </button>
        <button
          onClick={() => onOpenEditor(projectDir)}
          className="px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded transition-colors"
          title="Open in Editor"
        >
          Editor
        </button>
      </div>
    </div>
  )
}
