interface SectionProps {
  title: string
  accent?: 'default' | 'warning'
  action?: React.ReactNode
  children: React.ReactNode
}

export function Section({ title, accent = 'default', action, children }: SectionProps): React.JSX.Element {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h3
          className={`text-[11px] font-semibold uppercase tracking-widest ${
            accent === 'warning' ? 'text-amber-400/80' : 'text-zinc-500'
          }`}
        >
          {title}
        </h3>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  )
}
