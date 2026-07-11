type PortStatus = 'free' | 'in-use' | 'conflict'

const STATUS_STYLES: Record<PortStatus, string> = {
  conflict: 'bg-amber-500/10 text-amber-400',
  'in-use': 'bg-emerald-500/10 text-emerald-400',
  free: 'bg-zinc-700/50 text-zinc-400'
}

export function StatusChip({ status }: { status: PortStatus | string }): React.JSX.Element {
  const style = STATUS_STYLES[status as PortStatus] ?? STATUS_STYLES.free
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}>{status}</span>
  )
}
