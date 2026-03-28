import { useEffect, useRef, useState } from 'react'

interface LogViewerProps {
  projectName: string
  componentName: string
  onClose: () => void
}

export function LogViewer({ projectName, componentName, onClose }: LogViewerProps): React.JSX.Element {
  const [content, setContent] = useState('')
  const containerRef = useRef<HTMLPreElement>(null)
  const autoScrollRef = useRef(true)

  // Load initial content and start tailing
  useEffect(() => {
    window.api.getLog(projectName, componentName).then((log) => {
      setContent(log as string)
    })

    window.api.startLogTail(projectName, componentName)

    const unsubscribe = window.api.onLogData((data) => {
      setContent((prev) => prev + data.content)
    })

    return () => {
      unsubscribe()
      window.api.stopLogTail(projectName, componentName)
    }
  }, [projectName, componentName])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [content])

  const handleScroll = (): void => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50
  }

  return (
    <div className="flex flex-col border-t border-white/[0.06] bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
        <span className="text-[12px] font-mono text-zinc-400">
          {projectName}/{componentName}
        </span>
        <button
          onClick={onClose}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Close
        </button>
      </div>

      {/* Log content */}
      <pre
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-[200px] max-h-[300px] overflow-auto p-4 text-[11px] font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap break-all scrollbar-thin scrollbar-thumb-zinc-700"
      >
        {content || <span className="text-zinc-600 italic">No log output yet</span>}
      </pre>
    </div>
  )
}
