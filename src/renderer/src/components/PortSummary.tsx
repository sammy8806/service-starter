import { PortConflictView } from '../context/AppContext'

interface PortSummaryProps {
  totalPorts: number
  activePorts: number
  conflicts: PortConflictView[]
}

export function PortSummary({
  totalPorts,
  activePorts,
  conflicts
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

        {conflicts.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] text-amber-400 font-medium">
              {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Conflict details */}
      {conflicts.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {conflicts.map((conflict) => (
            <div
              key={conflict.port}
              className="text-[11px] font-mono text-amber-400/80 bg-amber-400/[0.06] rounded px-2 py-1"
            >
              <span className="text-amber-400">:{conflict.port}</span>
              <span className="text-zinc-500 mx-1">&larr;</span>
              <span>{conflict.claimants.join(', ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
