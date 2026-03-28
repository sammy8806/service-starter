import { useAppState } from '../../context/AppContext'
import { ConflictWarningBanner } from './ConflictWarningBanner'

interface PortRow {
  port: number
  label: string
  status: string
  owner: string
  project: string
  process?: string
  pid?: number
}

export function PortMapTab(): React.JSX.Element {
  const { state } = useAppState()

  const portRows: PortRow[] = []
  for (const project of Object.values(state.projects)) {
    for (const [compName, comp] of Object.entries(project.components)) {
      for (const port of comp.ports) {
        portRows.push({
          port: port.port,
          label: port.label,
          status: port.status,
          owner: compName,
          project: project.name,
          process: port.process,
          pid: port.pid
        })
      }
    }
  }

  // Sort by port number
  portRows.sort((a, b) => a.port - b.port)

  return (
    <div className="p-5 space-y-4">
      <ConflictWarningBanner conflicts={state.conflicts} />

      <div className="rounded-lg border border-white/[0.06] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 bg-zinc-800/50">
              <th className="px-4 py-2.5 font-medium">Port</th>
              <th className="px-4 py-2.5 font-medium">Label</th>
              <th className="px-4 py-2.5 font-medium">Project</th>
              <th className="px-4 py-2.5 font-medium">Component</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Process</th>
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
                  key={`${row.project}/${row.owner}/${row.port}`}
                  className={`hover:bg-white/[0.02] transition-colors ${
                    row.status === 'conflict' ? 'bg-amber-400/[0.03]' : ''
                  }`}
                >
                  <td className="px-4 py-2.5 font-mono tabular-nums text-zinc-300">
                    :{row.port}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">{row.label}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{row.project}</td>
                  <td className="px-4 py-2.5 text-zinc-400">{row.owner}</td>
                  <td className="px-4 py-2.5">
                    <PortStatusPill status={row.status} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500">
                    {row.process ? `${row.process} (${row.pid})` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PortStatusPill({ status }: { status: string }): React.JSX.Element {
  const config = {
    free: { bg: 'bg-zinc-700/50', text: 'text-zinc-400', label: 'Free' },
    'in-use': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'In Use' },
    conflict: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Conflict' }
  }[status] ?? { bg: 'bg-zinc-700/50', text: 'text-zinc-500', label: status }

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}
