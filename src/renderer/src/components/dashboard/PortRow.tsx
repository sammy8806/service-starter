import { useState } from 'react'
import type { ReassignResultView } from '../../context/AppContext'
import {
  nextAvailablePort,
  type PatchbayClaimant,
  type PatchbayPortRow
} from '../../utils/patchbayRows'

interface PortRowProps {
  row: PatchbayPortRow
  allRows: PatchbayPortRow[]
  onRun: (projectName: string, componentName: string) => void
  onStop: (projectName: string, componentName: string) => void
  onReassign: (
    projectName: string,
    componentName: string,
    portLabel: string,
    fromPort: number,
    newPort: number
  ) => Promise<ReassignResultView>
}

function claimantId(claimant: PatchbayClaimant): string {
  return `${claimant.projectName}/${claimant.componentName}/${claimant.label}`
}

export function PortRow({
  row,
  allRows,
  onRun,
  onStop,
  onReassign
}: PortRowProps): React.JSX.Element {
  const selectable = row.claimants.filter((claimant) => !claimant.isHolder)
  const [picking, setPicking] = useState(false)
  const [selectedId, setSelectedId] = useState<string | undefined>(
    selectable[0] ? claimantId(selectable[0]) : undefined
  )
  const [newPort, setNewPort] = useState(() => nextAvailablePort(allRows, row.port))
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const accent =
    row.kind === 'running'
      ? 'before:bg-emerald-400'
      : row.kind === 'contested'
        ? 'before:bg-amber-400'
        : row.kind === 'held'
          ? 'before:bg-gradient-to-b before:from-emerald-400 before:to-amber-400'
          : 'before:bg-transparent'
  const portColor =
    row.kind === 'running'
      ? 'text-emerald-400'
      : row.kind === 'contested' || row.kind === 'held'
        ? 'text-amber-400'
        : 'text-zinc-500'
  const rowTint =
    row.kind === 'running'
      ? 'bg-emerald-400/[0.04]'
      : row.kind === 'contested' || row.kind === 'held'
        ? 'bg-amber-400/[0.04]'
        : ''
  const single = row.claimants.length === 1 ? row.claimants[0] : undefined

  async function apply(): Promise<void> {
    const claimant = row.claimants.find((candidate) => claimantId(candidate) === selectedId)
    if (!claimant || claimant.isHolder) return

    setBusy(true)
    setError(undefined)
    try {
      const result = await onReassign(
        claimant.projectName,
        claimant.componentName,
        claimant.label,
        row.port,
        newPort
      )
      if (result.ok) {
        setPicking(false)
      } else {
        setError(result.message ?? 'Reassign failed')
        if (result.suggestedPort !== undefined) setNewPort(result.suggestedPort)
      }
    } catch {
      setError('Reassign failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`group relative border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] before:absolute before:inset-y-0 before:left-0 before:w-0.5 ${accent} ${rowTint}`}
    >
      <div className="flex min-h-[46px] items-center gap-3 pl-5 pr-5">
        <span className={`w-16 font-mono text-[16px] font-medium tabular-nums ${portColor}`}>
          {row.port}
        </span>

        {single ? (
          <>
            <span className="text-[13px] text-zinc-300">
              <span className="text-zinc-500">{single.projectName} /</span> {single.componentName}
            </span>
            <span className="ml-auto text-[11px] text-zinc-600">{single.label}</span>
            {row.kind === 'running' ? (
              <button
                type="button"
                onClick={() => onStop(single.projectName, single.componentName)}
                className="rounded-md border border-white/[0.12] px-2.5 py-1 text-[11px] text-zinc-300 hover:border-white/25"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRun(single.projectName, single.componentName)}
                className="rounded-md bg-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-900 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              >
                Run
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-1 py-2">
              {row.externalHolder && !row.claimants.some((claimant) => claimant.isHolder) ? (
                <div className="flex items-center gap-2 text-[12.5px] text-emerald-400">
                  <span>{row.holderProcess ?? 'external process'}</span>
                  <span className="ml-auto text-[11px] text-zinc-600">
                    holding{row.holderPid !== undefined ? ` · pid ${row.holderPid}` : ''}
                  </span>
                </div>
              ) : null}
              {row.claimants.map((claimant) => (
                <div key={claimantId(claimant)} className="flex items-center gap-2 text-[12.5px]">
                  <span className={claimant.isHolder ? 'text-emerald-400' : 'text-zinc-400'}>
                    <span className="text-zinc-600">{claimant.projectName} /</span>{' '}
                    {claimant.componentName}
                  </span>
                  <span className="ml-auto text-[11px] text-zinc-600">
                    {claimant.isHolder
                      ? `holding${row.holderPid !== undefined ? ` · pid ${row.holderPid}` : ''}`
                      : row.kind === 'held'
                        ? 'blocked'
                        : claimant.label}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              aria-expanded={picking}
              onClick={() => {
                setError(undefined)
                setPicking((value) => !value)
              }}
              className="rounded-md border border-amber-500/40 px-2.5 py-1 text-[11px] text-amber-400 hover:border-amber-400"
            >
              Reassign
            </button>
          </>
        )}
      </div>

      {picking ? (
        <div className="border-t border-amber-500/20 bg-zinc-800/40 px-5 py-3 pl-[84px]">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">
            Which one moves off :{row.port}?
          </div>
          <div className="flex flex-col gap-1">
            {row.externalHolder && !row.claimants.some((claimant) => claimant.isHolder) ? (
              <button
                type="button"
                disabled
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-zinc-400 disabled:opacity-40"
              >
                <span className="h-3 w-3 rounded-full border border-zinc-600" />
                {row.holderProcess ?? 'external process'}
                <span className="ml-auto text-[11px] text-zinc-600">
                  holding — stop outside the app
                </span>
              </button>
            ) : null}
            {row.claimants.map((claimant) => {
              const id = claimantId(claimant)
              const disabled = claimant.isHolder
              return (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedId(id)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] disabled:opacity-40 ${
                    selectedId === id
                      ? 'bg-amber-400/10 text-zinc-100'
                      : 'text-zinc-400 hover:bg-white/[0.03]'
                  }`}
                >
                  <span
                    className={`h-3 w-3 rounded-full border ${
                      selectedId === id ? 'border-4 border-amber-400' : 'border-zinc-600'
                    }`}
                  />
                  {claimant.projectName} / {claimant.componentName}
                  {disabled ? (
                    <span className="ml-auto text-[11px] text-zinc-600">holding — stop first</span>
                  ) : null}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-zinc-500">move to</span>
            <input
              type="number"
              min={1}
              max={65535}
              aria-label="New port"
              value={newPort}
              onChange={(event) => setNewPort(event.currentTarget.valueAsNumber || 0)}
              className="w-20 rounded-md border border-white/[0.12] bg-zinc-900 px-2 py-1 font-mono text-[13px] text-amber-400"
            />
            <span className="text-[11px] text-zinc-600">
              saved as an override, manifest untouched
            </span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => setPicking(false)}
                className="rounded-md border border-white/[0.12] px-2.5 py-1 text-[11px] text-zinc-400 hover:border-white/25"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void apply()}
                disabled={busy || selectedId === undefined}
                className="rounded-md bg-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-900 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
          {error ? <p className="mt-2 text-[12px] text-red-400">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
