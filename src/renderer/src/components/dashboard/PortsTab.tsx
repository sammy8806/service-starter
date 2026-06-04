import type { ComponentStateView } from '../../context/AppContext'

export function PortsTab({ component }: { component: ComponentStateView }): React.JSX.Element {
  if (component.ports.length === 0) {
    return <div className="p-5 text-[13px] text-zinc-500">No ports declared</div>
  }
  return (
    <div className="p-5">
      <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]">
        {component.ports.map((port) => (
          <div key={port.port} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
            <span
              className={`font-mono tabular-nums ${
                port.status === 'conflict'
                  ? 'text-amber-400'
                  : port.status === 'in-use'
                    ? 'text-emerald-400'
                    : 'text-zinc-500'
              }`}
            >
              :{port.port}
            </span>
            <span className="text-zinc-400">{port.label}</span>
            <span className="ml-auto text-[11px] text-zinc-500">{port.status}</span>
            {port.process && (
              <span className="font-mono text-[11px] text-zinc-600">
                {port.process} ({port.pid})
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
