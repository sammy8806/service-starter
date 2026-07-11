interface Tab<T extends string> {
  id: T
  label: string
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[]
  active: T
  onChange: (tab: T) => void
  ariaLabel: string
}

export function TabBar<T extends string>({ tabs, active, onChange, ariaLabel }: TabBarProps<T>): React.JSX.Element {
  return (
    <nav role="tablist" aria-label={ariaLabel} className="flex shrink-0 gap-0 border-b border-white/[0.06] px-5">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={`relative px-3 py-2 text-[13px] font-medium transition-colors ${
            active === t.id ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {t.label}
          {active === t.id && (
            <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-zinc-100" />
          )}
        </button>
      ))}
    </nav>
  )
}
