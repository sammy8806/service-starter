import { useMemo, useState } from 'react'
import type { AppStateView } from '../../context/AppContext'
import { computeKpis } from '../../utils/dashboardStats'
import { collectDockerDependencies, dependencyStatusLabel, dependencyStatusTone } from '../../utils/dependencyDisplay'
import { KpiCard } from './ui/KpiCard'
import { Section } from './ui/Section'
import { StatusChip } from './ui/StatusChip'
import { EmptyState } from './ui/EmptyState'

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

const DOCKER_TONE_CLASS = {
  healthy: 'text-emerald-400',
  unhealthy: 'text-red-400',
  unknown: 'text-zinc-500',
  warning: 'text-amber-400'
} as const

export function OverviewDetail({ state }: OverviewDetailProps): React.JSX.Element {
  const kpis = computeKpis(state)
  const portRows = buildPortRows(state)
  const [portFilter, setPortFilter] = useState('')
  const dockerRows = useMemo(() => collectDockerDependencies(state), [state])

  const filteredRows = useMemo(() => {
    const q = portFilter.trim().toLowerCase()
    if (!q) return portRows
    return portRows.filter(
      (row) =>
        String(row.port).includes(q) ||
        row.label.toLowerCase().includes(q) ||
        row.project.toLowerCase().includes(q) ||
        row.component.toLowerCase().includes(q) ||
        row.status.includes(q)
    )
  }, [portRows, portFilter])

  const projectCount = Object.keys(state.projects).length

  if (projectCount === 0) {
    return (
      <EmptyState
        title="No projects discovered"
        description="Add scan directories in Settings and place .service-starter.yml manifests in your projects."
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/[0.06] px-5 py-4">
        <h2 className="text-[15px] font-semibold text-zinc-100">Overview</h2>
        <p className="mt-0.5 text-[12px] text-zinc-500">Cross-project health at a glance</p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <div className="flex flex-wrap gap-3">
          <KpiCard value={kpis.running} label="Running" accent="text-emerald-400" />
          <KpiCard value={`${kpis.activePorts}/${kpis.totalPorts}`} label="Ports active" />
          <KpiCard
            value={kpis.conflicts}
            label="Conflicts"
            accent={kpis.conflicts > 0 ? 'text-amber-400' : undefined}
          />
          <KpiCard value={projectCount} label="Projects" />
        </div>

        {dockerRows.length > 0 && (
          <Section title="Docker Containers">
            <div className="overflow-hidden rounded-lg border border-white/[0.06]">
              <table className="w-full text-[13px]">
                <thead className="bg-zinc-800/50 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Container
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Project
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Detail
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {dockerRows.map((row) => (
                    <tr key={row.key} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 font-medium text-zinc-300">{row.container}</td>
                      <td className="px-4 py-2.5 text-zinc-400">
                        {row.project}
                        {row.component ? ` / ${row.component}` : ''}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-[12px] font-medium ${DOCKER_TONE_CLASS[dependencyStatusTone(row.dep)]}`}
                        >
                          {dependencyStatusLabel(row.dep)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-zinc-500">
                        {row.dep.docker?.statusText ?? row.dep.docker?.matchedName ?? row.dep.error ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {state.conflicts.length > 0 && (
          <Section title="Port Conflicts" accent="warning">
            <div className="divide-y divide-white/[0.04] rounded-lg border border-amber-500/20 bg-amber-400/[0.03]">
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
          </Section>
        )}

        <Section
          title="Port Map"
          action={
            portRows.length > 0 ? (
              <input
                type="search"
                value={portFilter}
                onChange={(e) => setPortFilter(e.target.value)}
                placeholder="Filter ports…"
                aria-label="Filter port map"
                className="w-40 rounded-md border border-white/[0.08] bg-zinc-800/80 px-2 py-1 text-[11px] text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            ) : undefined
          }
        >
          <div className="overflow-hidden rounded-lg border border-white/[0.06]">
            <div className="max-h-[min(420px,50vh)] overflow-auto">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 z-10 bg-zinc-800/95 backdrop-blur-sm">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500">
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
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                        {portRows.length === 0 ? 'No ports declared' : 'No matching ports'}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={`${row.project}/${row.component}/${row.port}`}
                        className={`transition-colors hover:bg-white/[0.02] ${row.status === 'conflict' ? 'bg-amber-400/[0.03]' : ''}`}
                      >
                        <td className="px-4 py-2.5 font-mono tabular-nums text-zinc-300">:{row.port}</td>
                        <td className="px-4 py-2.5 text-zinc-400">{row.label}</td>
                        <td className="px-4 py-2.5 text-zinc-400">{row.project}</td>
                        <td className="px-4 py-2.5 text-zinc-400">{row.component}</td>
                        <td className="px-4 py-2.5">
                          <StatusChip status={row.status} />
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
          </div>
        </Section>
      </div>
    </div>
  )
}
