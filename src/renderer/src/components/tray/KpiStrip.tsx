interface KpiStripProps {
  running: number
  conflicts: number
}

export function KpiStrip({ running, conflicts }: KpiStripProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-4 px-3 py-1.5 border-b border-white/[0.06] bg-zinc-900/60">
      <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="font-mono tabular-nums text-zinc-300">{running}</span> running
      </span>
      {conflicts > 0 && (
        <span className="flex items-center gap-1.5 text-[11px] text-amber-400">
          <span aria-hidden>⚠</span>
          <span className="font-mono tabular-nums">{conflicts}</span>
          {conflicts === 1 ? ' conflict' : ' conflicts'}
        </span>
      )}
    </div>
  )
}
