import { ReactNode } from 'react'

interface ContextMenuTriggerProps {
  onShow: () => void
  label: string
  children?: ReactNode
}

export function ContextMenuTrigger({
  onShow,
  label,
  children
}: ContextMenuTriggerProps): React.JSX.Element {
  return (
    <div
      className="contents"
      onContextMenu={(e) => {
        e.preventDefault()
        onShow()
      }}
    >
      {children}
      <button
        aria-label={label}
        title="More actions"
        onClick={(e) => {
          e.stopPropagation()
          onShow()
        }}
        className="p-1 rounded text-zinc-500 opacity-70 hover:opacity-100 hover:bg-white/10 hover:text-zinc-300 transition"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
    </div>
  )
}
