interface EmptyStateProps {
  title: string
  description?: string
}

export function EmptyState({ title, description }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <p className="text-[13px] text-zinc-400">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[12px] text-zinc-600">{description}</p>}
    </div>
  )
}
