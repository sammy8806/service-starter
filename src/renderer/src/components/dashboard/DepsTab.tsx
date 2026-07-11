import type { ComponentStateView } from '../../context/AppContext'
import { DependencyRow } from './DependencyRow'

export function DepsTab({ component }: { component: ComponentStateView }): React.JSX.Element {
  if (component.dependencies.length === 0) {
    return <div className="p-5 text-[13px] text-zinc-500">No dependencies configured</div>
  }

  return (
    <div className="p-5">
      <div className="divide-y divide-white/[0.04] rounded-lg border border-white/[0.06]">
        {component.dependencies.map((dep, i) => (
          <DependencyRow key={`${dependencyKey(dep)}-${i}`} dep={dep} />
        ))}
      </div>
    </div>
  )
}

function dependencyKey(dep: ComponentStateView['dependencies'][number]): string {
  return dep.dependency.name ?? dep.dependency.container ?? dep.dependency.type
}
