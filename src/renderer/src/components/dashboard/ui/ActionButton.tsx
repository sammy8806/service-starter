type ActionVariant = 'primary' | 'danger' | 'neutral'

const VARIANTS: Record<ActionVariant, string> = {
  primary: 'text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-400/10',
  danger: 'text-red-400/80 hover:text-red-400 hover:bg-red-400/10',
  neutral: 'text-zinc-300 hover:bg-white/[0.06]'
}

interface ActionButtonProps {
  variant?: ActionVariant
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}

export function ActionButton({
  variant = 'neutral',
  onClick,
  disabled,
  children
}: ActionButtonProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]}`}
    >
      {children}
    </button>
  )
}
