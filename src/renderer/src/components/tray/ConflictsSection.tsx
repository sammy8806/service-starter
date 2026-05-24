import { ConflictRow as ConflictRowData } from '../../utils/sortServices'
import { ConflictRow } from './ConflictRow'

interface ConflictsSectionProps {
  conflicts: ConflictRowData[]
  selectedId: string | null
  onKillPort: (port: number) => void
  onShowMenu: (conflict: ConflictRowData) => void
  onHover: (id: string) => void
}

export function ConflictsSection({
  conflicts,
  selectedId,
  onKillPort,
  onShowMenu,
  onHover
}: ConflictsSectionProps): React.JSX.Element | null {
  if (conflicts.length === 0) return null

  return (
    <div>
      <div className="sticky top-0 z-10 px-3 py-1 bg-zinc-900/60 backdrop-blur text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
        ⚠ CONFLICTS ({conflicts.length})
      </div>
      {conflicts.map((conflict) => {
        const id = `conflict:${conflict.port}`
        return (
          <ConflictRow
            key={id}
            conflict={conflict}
            selected={selectedId === id}
            onKillPort={onKillPort}
            onShowMenu={() => onShowMenu(conflict)}
            onHover={() => onHover(id)}
          />
        )
      })}
    </div>
  )
}
