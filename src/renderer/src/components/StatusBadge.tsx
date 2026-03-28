interface StatusBadgeProps {
  status: 'running' | 'stopped' | 'warning' | 'healthy' | 'unhealthy' | 'unknown'
  size?: 'sm' | 'md'
}

const STATUS_CONFIG = {
  running: { color: 'bg-emerald-400', pulse: true, label: 'Running' },
  healthy: { color: 'bg-emerald-400', pulse: false, label: 'Healthy' },
  stopped: { color: 'bg-zinc-500', pulse: false, label: 'Stopped' },
  warning: { color: 'bg-amber-400', pulse: true, label: 'Warning' },
  unhealthy: { color: 'bg-red-400', pulse: false, label: 'Unhealthy' },
  unknown: { color: 'bg-zinc-600', pulse: false, label: 'Unknown' }
} as const

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps): React.JSX.Element {
  const config = STATUS_CONFIG[status]
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'

  return (
    <span className="inline-flex items-center gap-1.5" title={config.label}>
      <span className="relative flex">
        <span className={`${dotSize} rounded-full ${config.color}`} />
        {config.pulse && (
          <span
            className={`absolute inset-0 ${dotSize} rounded-full ${config.color} opacity-75 animate-ping`}
          />
        )}
      </span>
    </span>
  )
}
