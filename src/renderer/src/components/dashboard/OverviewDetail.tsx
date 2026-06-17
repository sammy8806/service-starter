import type { AppStateView } from '../../context/AppContext'
import { computeKpis } from '../../utils/dashboardStats'

interface OverviewDetailProps {
  state: AppStateView
}

interface PortRow {
  port: number
  label: string
  status: string
  project: string
  component: string
  process?: string
  pid?: number
}

function buildPortRows(state: AppStateView): PortRow[] {
  const rows: PortRow[] = []
  for (const project of Object.values(state.projects)) {
    for (const [compName, comp] of Object.entries(project.components)) {
      for (const port of comp.ports) {
        rows.push({
          port: port.port,
          label: port.label,
          status: port.status,
          project: project.name,
          component: compName,
          process: port.process,
          pid: port.pid
        })
      }
    }
  }
  return rows.sort((a, b) => a.port - b.port)
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)]
}

function Kpi({
  value,
  label,
  accent
}: {
  value: number
  label: string
  accent?: string
}): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <span className={`text-[20px] font-semibold tabular-nums ${accent ?? 'text-zinc-100'}`}>
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
    </div>
  )
}

export function OverviewDetail({ state }: OverviewDetailProps): React.JSX.Element {
  const kpis = computeKpis(state)
  const portRows = buildPortRows(state)

  return (
    <div className="p-5 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
      <div className="flex gap-10">
        <Kpi value={kpis.running} label="Running" accent="text-emerald-400" />
        <Kpi value={kpis.activePorts} label={`/ ${kpis.totalPorts} Ports`} />
        <Kpi
          value={kpis.conflicts}
          label="Conflicts"
          accent={kpis.conflicts > 0 ? 'text-amber-400' : undefined}
        />
      </div>

      {state.conflicts.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/80 mb-2">
            Port Conflicts
          </h3>
          <div className="rounded-lg border border-amber-500/20 bg-amber-400/[0.03] divide-y divide-white/[0.04]">
            {state.conflicts.map((c) => {
              const claimants = uniqueValues(c.claimants)
              return (
                <div key={c.port} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                  <span className="shrink-0 font-mono tabular-nums text-amber-400">:{c.port}</span>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {claimants.map((claimant) => (
                      <span
                        key={claimant}
                        className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400"
                      >
                        {claimant}
                      </span>
                    ))}
                  </div>
                  {c.activeProcess && (
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-zinc-500">
                      {c.activeProcess}
                      {c.activePid ? ` (${c.activePid})` : ''}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
          Port Map
        </h3>
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 bg-zinc-800/50">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Port
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Label
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Project
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Component
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Process
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {portRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    No ports declared
                  </td>
                </tr>
              ) : (
                portRows.map((row) => (
                  <tr
                    key={`${row.project}/${row.component}/${row.port}`}
                    className={`hover:bg-white/[0.02] transition-colors ${row.status === 'conflict' ? 'bg-amber-400/[0.03]' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-mono tabular-nums text-zinc-300">
                      :{row.port}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400">{row.label}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{row.project}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{row.component}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          row.status === 'conflict'
                            ? 'bg-amber-500/10 text-amber-400'
                            : row.status === 'in-use'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-zinc-700/50 text-zinc-400'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500">
                      {row.process
                        ? `${row.process}${row.pid !== undefined ? ` (${row.pid})` : ''}`
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
