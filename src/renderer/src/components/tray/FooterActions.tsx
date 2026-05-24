import { ContextMenuTrigger } from './ContextMenuTrigger'

interface FooterActionsProps {
  activePorts: number
  totalPorts: number
  projectCount: number
  onShowMenu: () => void
  onOpenDashboard: () => void
}

export function FooterActions({
  activePorts,
  totalPorts,
  projectCount,
  onShowMenu,
  onOpenDashboard
}: FooterActionsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 px-3 py-1 border-t border-white/[0.06] bg-black/20">
      <span className="text-[10px] font-mono tabular-nums text-zinc-500 flex-1">
        {activePorts}/{totalPorts} ports · {projectCount}{' '}
        {projectCount === 1 ? 'project' : 'projects'}
      </span>
      <button
        onClick={onOpenDashboard}
        className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
      >
        Dashboard →
      </button>
      <ContextMenuTrigger onShow={onShowMenu} label="More actions" />
    </div>
  )
}
