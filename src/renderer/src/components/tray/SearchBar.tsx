import { forwardRef } from 'react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onFocusChange: (focused: boolean) => void
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { value, onChange, onFocusChange },
  ref
): React.JSX.Element {
  return (
    <div className={`flex items-center gap-2 px-3 py-0.5 border-b border-white/[0.04] transition-opacity ${value ? 'opacity-100' : 'opacity-40 focus-within:opacity-100'}`}>
      <svg className="w-3 h-3 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3m1.8-4.7a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
      </svg>
      <input
        ref={ref}
        value={value}
        placeholder="Search…"
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value)
        }}
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value.length > 0) {
            e.preventDefault()
            e.stopPropagation()
            onChange('')
          }
        }}
        className="flex-1 min-w-0 bg-transparent text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none"
      />
      <kbd className="text-[9px] text-zinc-700 font-mono flex-shrink-0">⌘F</kbd>
    </div>
  )
})
