import type { DependencyStateView } from '../../context/AppContext'
import { StatusBadge } from '../StatusBadge'
import { DockerContainerActions } from './DockerContainerActions'
import {
  dependencyBadgeStatus,
  dependencyDetailLine,
  dependencyLabel,
  dependencyManifestRef,
  dependencyStatusLabel,
  dependencyStatusTone
} from '../../utils/dependencyDisplay'

interface DependencyRowProps {
  dep: DependencyStateView
}

const TONE_CLASS = {
  healthy: 'text-emerald-400',
  unhealthy: 'text-red-400',
  unknown: 'text-zinc-500',
  warning: 'text-amber-400',
  stopped: 'text-zinc-500'
} as const

export function DependencyRow({ dep }: DependencyRowProps): React.JSX.Element {
  const label = dependencyLabel(dep)
  const manifestRef = dependencyManifestRef(dep)
  const statusLabel = dependencyStatusLabel(dep)
  const badge = dependencyBadgeStatus(dep)
  const tone = dependencyStatusTone(dep)
  const detail = dependencyDetailLine(dep)

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
      <StatusBadge status={badge} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-300">{label}</span>
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
            {dep.dependency.type}
          </span>
        </div>
        {(manifestRef || detail) && (
          <div className="mt-0.5 truncate text-[11px] text-zinc-500">
            {[manifestRef, detail].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      <DockerContainerActions dep={dep} />
      <span className={`shrink-0 text-[12px] font-medium ${TONE_CLASS[tone]}`}>{statusLabel}</span>
    </div>
  )
}
