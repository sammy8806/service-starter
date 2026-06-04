import type { ComponentStateView } from '../../context/AppContext'
import { StatusBadge } from '../StatusBadge'

export function DepsTab({ component }: { component: ComponentStateView }): React.JSX.Element {
  if (component.dependencies.length === 0) {
    return <div className="p-5 text-[13px] text-zinc-500">No dependencies configured</div>
  }
  return (
    <div className="p-5">
      <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]">
        {component.dependencies.map((dep, i) => {
          const name = dep.dependency.name ?? dep.dependency.container ?? 'unknown'
          return (
            <div key={`${name}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <StatusBadge
                status={
                  dep.health === 'healthy'
                    ? 'healthy'
                    : dep.health === 'unhealthy'
                      ? 'unhealthy'
                      : 'unknown'
                }
                size="md"
              />
              <span className="text-zinc-300 font-medium">{name}</span>
              <span className="text-[11px] text-zinc-600">{dep.dependency.type}</span>
              <span
                className={`ml-auto text-[12px] font-medium ${
                  dep.health === 'healthy'
                    ? 'text-emerald-400'
                    : dep.health === 'unhealthy'
                      ? 'text-red-400'
                      : 'text-zinc-500'
                }`}
              >
                {dep.health}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
