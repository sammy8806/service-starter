import { useAppState, DependencyStateView } from '../../context/AppContext'
import { StatusBadge } from '../StatusBadge'

interface DependencyGroup {
  type: string
  items: {
    name: string
    project: string
    component?: string
    state: DependencyStateView
  }[]
}

export function DependenciesTab(): React.JSX.Element {
  const { state } = useAppState()

  // Collect all dependencies across projects
  const allDeps: DependencyGroup[] = []
  const typeMap = new Map<string, DependencyGroup['items']>()

  for (const project of Object.values(state.projects)) {
    // Project-level deps
    for (const dep of project.dependencies) {
      const type = dep.dependency.type
      if (!typeMap.has(type)) typeMap.set(type, [])
      typeMap.get(type)!.push({
        name: (dep.dependency as { name?: string; container?: string }).name ??
              (dep.dependency as { container?: string }).container ?? 'unknown',
        project: project.name,
        state: dep
      })
    }

    // Component-level deps
    for (const [compName, comp] of Object.entries(project.components)) {
      for (const dep of comp.dependencies) {
        const type = dep.dependency.type
        if (!typeMap.has(type)) typeMap.set(type, [])
        typeMap.get(type)!.push({
          name: (dep.dependency as { name?: string; container?: string }).name ??
                (dep.dependency as { container?: string }).container ?? 'unknown',
          project: project.name,
          component: compName,
          state: dep
        })
      }
    }
  }

  const TYPE_LABELS: Record<string, string> = {
    docker: 'Docker Containers',
    service: 'Services',
    api: 'APIs',
    project: 'Project Dependencies'
  }

  for (const [type, items] of typeMap) {
    allDeps.push({ type: TYPE_LABELS[type] ?? type, items })
  }

  if (allDeps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-[14px] text-zinc-400">No dependencies configured</p>
        <p className="text-[12px] text-zinc-600 mt-1">
          Add dependencies to your project manifests to monitor them here.
        </p>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-5">
      {allDeps.map((group) => (
        <div key={group.type}>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
            {group.type}
          </h3>
          <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]">
            {group.items.map((item, i) => (
              <div
                key={`${item.name}-${item.project}-${i}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <StatusBadge
                  status={item.state.health === 'healthy' ? 'healthy' :
                          item.state.health === 'unhealthy' ? 'unhealthy' : 'unknown'}
                  size="md"
                />

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-zinc-300 font-medium">{item.name}</div>
                  <div className="text-[11px] text-zinc-600 mt-0.5">
                    {item.project}{item.component ? ` / ${item.component}` : ''}
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[12px] font-medium ${
                    item.state.health === 'healthy' ? 'text-emerald-400' :
                    item.state.health === 'unhealthy' ? 'text-red-400' : 'text-zinc-500'
                  }`}>
                    {item.state.health}
                  </span>
                  {item.state.error && (
                    <div className="text-[11px] text-zinc-600 mt-0.5 max-w-xs truncate" title={item.state.error}>
                      {item.state.error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
