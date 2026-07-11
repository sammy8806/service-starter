interface DetailHeaderProps {
  title: string
  subtitle?: string
  leading?: React.ReactNode
  actions?: React.ReactNode
}

export function DetailHeader({ title, subtitle, leading, actions }: DetailHeaderProps): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-zinc-100">{title}</div>
        {subtitle && <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
