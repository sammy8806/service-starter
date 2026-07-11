import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppState } from '../../context/AppContext'
import { buildDashboardTree } from '../../utils/dashboardTree'
import { ProjectTree, Selection } from './ProjectTree'
import { OverviewDetail } from './OverviewDetail'
import { ProjectDetail } from './ProjectDetail'
import { ComponentDetail } from './ComponentDetail'
import { SettingsView } from './SettingsView'

type View = 'projects' | 'settings'

function parseHash(): { view: View; selection: Selection } {
  const hash = window.location.hash.replace(/^#dashboard\/?/, '')
  if (hash === 'settings') return { view: 'settings', selection: { kind: 'overview' } }

  const parts = hash.split('/').filter(Boolean)
  if (parts[0] === 'component' && parts.length >= 3) {
    return {
      view: 'projects',
      selection: { kind: 'component', projectName: parts[1], componentName: parts[2] }
    }
  }
  if (parts[0] === 'project' && parts.length >= 2) {
    return { view: 'projects', selection: { kind: 'project', projectName: parts[1] } }
  }
  return { view: 'projects', selection: { kind: 'overview' } }
}

function selectionToHash(view: View, selection: Selection): string {
  if (view === 'settings') return '#dashboard/settings'
  if (selection.kind === 'component') {
    return `#dashboard/component/${selection.projectName}/${selection.componentName}`
  }
  if (selection.kind === 'project') return `#dashboard/project/${selection.projectName}`
  return '#dashboard'
}

export function DashboardWindow(): React.JSX.Element {
  const ctx = useAppState()
  const { state } = ctx
  const initial = useMemo(() => parseHash(), [])
  const [view, setView] = useState<View>(initial.view)
  const [selection, setSelection] = useState<Selection>(initial.selection)

  const tree = useMemo(() => buildDashboardTree(state), [state])

  const navigate = useCallback((nextView: View, nextSelection: Selection) => {
    setView(nextView)
    setSelection(nextSelection)
    const hash = selectionToHash(nextView, nextSelection)
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash)
    }
  }, [])

  useEffect(() => {
    const onHashChange = (): void => {
      const parsed = parseHash()
      setView(parsed.view)
      setSelection(parsed.selection)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const selectedProject =
    selection.kind === 'project' || selection.kind === 'component'
      ? state.projects[selection.projectName]
      : undefined
  const selectedComponent =
    selection.kind === 'component'
      ? selectedProject?.components[selection.componentName]
      : undefined

  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-zinc-100">
      <div
        className="flex shrink-0 items-center gap-4 border-b border-white/[0.06] pl-20 pr-5 py-2.5"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <h1 className="text-[13px] font-semibold tracking-tight text-zinc-400">Service Starter</h1>
        <nav className="flex gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {(['projects', 'settings'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => navigate(v, v === 'settings' ? { kind: 'overview' } : selection)}
              className={`rounded-md px-3 py-1 text-[13px] font-medium transition-colors ${
                view === v ? 'bg-white/[0.08] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {v === 'projects' ? 'Projects' : 'Settings'}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex min-h-0 flex-1">
        {view === 'settings' ? (
          <SettingsView />
        ) : (
          <>
            <ProjectTree
              tree={tree}
              selection={selection}
              onSelect={(sel) => navigate('projects', sel)}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
                    navigate('projects', {
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
