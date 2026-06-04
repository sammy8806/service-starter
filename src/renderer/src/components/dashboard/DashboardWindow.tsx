import { useMemo, useState } from 'react'
import { useAppState } from '../../context/AppContext'
import { buildDashboardTree } from '../../utils/dashboardTree'
import { ProjectTree, Selection } from './ProjectTree'
import { OverviewDetail } from './OverviewDetail'
import { ProjectDetail } from './ProjectDetail'
import { ComponentDetail } from './ComponentDetail'
import { SettingsView } from './SettingsView'

type View = 'projects' | 'settings'

export function DashboardWindow(): React.JSX.Element {
  const ctx = useAppState()
  const { state } = ctx
  const [view, setView] = useState<View>('projects')
  const [selection, setSelection] = useState<Selection>({ kind: 'overview' })

  const tree = useMemo(() => buildDashboardTree(state), [state])

  const selectedProject =
    selection.kind === 'project' || selection.kind === 'component'
      ? state.projects[selection.projectName]
      : undefined
  const selectedComponent =
    selection.kind === 'component'
      ? selectedProject?.components[selection.componentName]
      : undefined

  return (
    <div className="h-screen flex flex-col bg-zinc-900 text-zinc-100">
      {/* Title bar / drag region */}
      <div
        className="flex items-center gap-4 pl-20 pr-5 pt-3 pb-2"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <h1 className="text-[13px] font-semibold tracking-tight text-zinc-300">Service Starter</h1>
        <nav className="flex gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {(['projects', 'settings'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-[13px] font-medium rounded-md transition-colors ${
                view === v ? 'bg-white/[0.08] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {v === 'projects' ? 'Projects' : 'Settings'}
            </button>
          ))}
        </nav>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0 border-t border-white/[0.06]">
        {view === 'settings' ? (
          <SettingsView />
        ) : (
          <>
            <ProjectTree tree={tree} selection={selection} onSelect={setSelection} />
            <div className="flex-1 flex flex-col min-h-0">
              {selection.kind === 'component' && selectedProject && selectedComponent ? (
                <ComponentDetail
                  projectName={selection.projectName}
                  directory={selectedProject.directory}
                  component={selectedComponent}
                  onStart={(p, c) => {
                    void ctx.startComponent(p, c)
                  }}
                  onStop={(p, c) => {
                    void ctx.stopComponent(p, c)
                  }}
                  onRestart={(p, c) => {
                    void ctx.restartComponent(p, c)
                  }}
                />
              ) : selection.kind === 'project' && selectedProject ? (
                <ProjectDetail
                  project={selectedProject}
                  onStartProject={(p) => {
                    void ctx.startProject(p)
                  }}
                  onStopProject={(p) => {
                    void ctx.stopProject(p)
                  }}
                  onSelectComponent={(componentName) =>
                    setSelection({
                      kind: 'component',
                      projectName: selectedProject.name,
                      componentName
                    })
                  }
                />
              ) : (
                <OverviewDetail state={state} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
