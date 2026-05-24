import { ContextMenuTrigger } from './ContextMenuTrigger'

interface FooterActionsProps {
  activePorts: number
  totalPorts: number
  projectCount: number
  onShowMenu: () => void
}

export function FooterActions({
  activePorts,
  totalPorts,
  projectCount,
  onShowMenu
}: FooterActionsProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.06] bg-black/20">
      <span className="text-[11px] font-mono tabular-nums text-zinc-400">
        {activePorts}/{totalPorts} ports · {projectCount}{' '}
        {projectCount === 1 ? 'project' : 'projects'}
      </span>
      <ContextMenuTrigger onShow={onShowMenu} label="More actions" />
    </div>
  )
}
