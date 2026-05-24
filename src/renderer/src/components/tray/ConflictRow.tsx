import { ConflictRow as ConflictRowData } from '../../utils/sortServices'
import { ContextMenuTrigger } from './ContextMenuTrigger'

interface ConflictRowProps {
  conflict: ConflictRowData
  selected: boolean
  onKillPort: (port: number) => void
  onShowMenu: () => void
  onHover: () => void
}

export function ConflictRow({
  conflict,
  selected,
  onKillPort,
  onShowMenu,
  onHover
}: ConflictRowProps): React.JSX.Element {
  return (
    <div
      onMouseMove={onHover}
      onContextMenu={(e) => {
        e.preventDefault()
        onShowMenu()
      }}
      className={`group flex items-center gap-2 px-3 py-2 border-l border-amber-400 transition-colors ${
        selected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
      }`}
    >
      <span aria-hidden className="text-amber-400 text-[12px]">⚠</span>
      <span className="flex-1 min-w-0 text-[13.5px] text-zinc-300 truncate">{conflict.primaryLabel}</span>
      <span className="font-mono text-[11px] tabular-nums text-amber-400 flex-shrink-0">:{conflict.port}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onKillPort(conflict.port)
        }}
        aria-label={`Kill :${conflict.port}`}
        title={`Kill :${conflict.port}`}
        className="px-1.5 py-0.5 rounded text-[11px] text-zinc-400 opacity-70 hover:opacity-100 hover:bg-red-500/20 hover:text-red-300 transition flex-shrink-0"
      >
        kill
      </button>
      <ContextMenuTrigger onShow={onShowMenu} label={`More actions for ${conflict.primaryLabel}`} />
    </div>
  )
}
