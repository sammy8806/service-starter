interface PortSummaryProps {
  totalPorts: number
  activePorts: number
}

export function PortSummary({
  totalPorts,
  activePorts
}: PortSummaryProps): React.JSX.Element {
  return (
    <div className="px-3 py-2 border-t border-white/[0.06] bg-black/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-500">
            <span className="font-mono tabular-nums text-zinc-400">{activePorts}</span>
            <span className="mx-0.5">/</span>
            <span className="font-mono tabular-nums">{totalPorts}</span>
            {' ports active'}
          </span>
        </div>
      </div>
    </div>
  )
}
