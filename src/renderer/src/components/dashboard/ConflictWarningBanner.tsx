import { PortConflictView } from '../../context/AppContext'

interface ConflictWarningBannerProps {
  conflicts: PortConflictView[]
}

export function ConflictWarningBanner({
  conflicts
}: ConflictWarningBannerProps): React.JSX.Element | null {
  if (conflicts.length === 0) return null

  return (
    <section>
      <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.07] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-400/10">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-amber-300">
              {conflicts.length} port conflict{conflicts.length !== 1 ? 's' : ''} detected
            </p>
            <p className="text-[11px] text-amber-100/60">
              Review the affected ports below.
            </p>
          </div>
        </div>

        <div className="px-4 py-3 space-y-2">
          {conflicts.map((conflict) => (
            <div
              key={`${conflict.type}-${conflict.port}`}
              className="rounded-md bg-black/20 px-3 py-2 text-[12px]"
            >
              <div className="flex items-center gap-2 text-amber-200">
                <span className="font-mono text-amber-300">:{conflict.port}</span>
                <span className="rounded-full border border-amber-400/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-200/70">
                  {conflict.type}
                </span>
              </div>
              <div className="mt-1 text-zinc-300">
                {conflict.claimants.join(', ')}
              </div>
              {conflict.activeProcess && (
                <div className="mt-1 text-[11px] text-zinc-500">
                  Active process: {conflict.activeProcess}
                  {conflict.activePid ? ` (${conflict.activePid})` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
