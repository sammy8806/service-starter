interface KpiCardProps {
  value: number | string
  label: string
  accent?: string
}

export function KpiCard({ value, label, accent }: KpiCardProps): React.JSX.Element {
  return (
    <div className="flex min-w-[88px] flex-col rounded-lg border border-white/[0.06] bg-zinc-800/40 px-4 py-3">
      <span className={`text-[22px] font-semibold tabular-nums leading-none ${accent ?? 'text-zinc-100'}`}>
        {value}
      </span>
      <span className="mt-1.5 text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
    </div>
  )
}
