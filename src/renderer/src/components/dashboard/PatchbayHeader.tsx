export type PatchbayFilter = 'all' | 'contested' | 'running'

interface PatchbayHeaderProps {
  summary: { services: number; running: number; contested: number; containersUp: number }
  filter: PatchbayFilter
  onFilterChange: (next: PatchbayFilter) => void
}

const FILTERS: PatchbayFilter[] = ['all', 'contested', 'running']

export function PatchbayHeader({
  summary,
  filter,
  onFilterChange
}: PatchbayHeaderProps): React.JSX.Element {
  return (
    <div className="shrink-0 border-b border-white/[0.06] px-5 py-4">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[15px] font-semibold text-zinc-100">localhost</h2>
        <p className="text-[12px] text-zinc-500">
          {summary.services} services ·{' '}
          <span className="text-emerald-400">{summary.running} running</span> ·{' '}
          <span className={summary.contested > 0 ? 'text-amber-400' : undefined}>
            {summary.contested} contested
          </span>{' '}
          · {summary.containersUp} container{summary.containersUp === 1 ? '' : 's'} up
        </p>
        <div className="ml-auto flex gap-1">
          {FILTERS.map((nextFilter) => (
            <button
              key={nextFilter}
              type="button"
              aria-pressed={filter === nextFilter}
              onClick={() => onFilterChange(nextFilter)}
              className={`rounded-full px-2.5 py-1 text-[11px] capitalize transition-colors ${
                filter === nextFilter
                  ? 'bg-white/[0.08] text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {nextFilter}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
