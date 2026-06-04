import { useEffect, useRef, useState } from 'react'
import type { ComponentStateView } from '../../context/AppContext'

interface LogsTabProps {
  projectName: string
  componentName: string
  processOrigin: ComponentStateView['processOrigin']
  directory: string
}

export function LogsTab({
  projectName,
  componentName,
  processOrigin,
  directory
}: LogsTabProps): React.JSX.Element {
  const [content, setContent] = useState('')
  const containerRef = useRef<HTMLPreElement>(null)
  const autoScrollRef = useRef(true)
  const hasLogs = processOrigin === 'managed'

  useEffect(() => {
    if (!hasLogs) return
    let active = true
    window.api.getLog(projectName, componentName).then((log) => {
      if (active) setContent(log)
    })
    window.api.startLogTail(projectName, componentName)
    const unsubscribe = window.api.onLogData((data) => {
      // onLogData fires for all tailed files — scope to this project's component.
      // Component names aren't unique across projects, so match the project directory too.
      // Use a path-segment boundary (directory + '/') to avoid prefix collisions
      // (e.g. '/projects/shop' must not match '/projects/shop-staging').
      if (!data.logFile.startsWith(`${directory}/`) || !data.logFile.endsWith(`/${componentName}.log`))
        return
      setContent((prev) => prev + data.content)
    })
    return () => {
      active = false
      unsubscribe()
      window.api.stopLogTail(projectName, componentName)
    }
  }, [projectName, componentName, hasLogs, directory])

  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [content])

  const handleScroll = (): void => {
    const el = containerRef.current
    if (!el) return
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  }

  if (!hasLogs) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
        <p className="text-[13px] text-zinc-400">No logs — external process</p>
        <p className="text-[12px] text-zinc-600 mt-1 max-w-xs">
          Logs are only captured for services started by Service Starter.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 min-h-0">
      <div className="flex items-center justify-end gap-3 px-4 py-1.5 border-b border-white/[0.06]">
        <button
          onClick={() => window.api.copyToClipboard(content)}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Copy
        </button>
        <button
          onClick={() => setContent('')}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Clear
        </button>
      </div>
      <pre
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-4 text-[11px] font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap break-all scrollbar-thin scrollbar-thumb-zinc-700"
      >
        {content || <span className="text-zinc-600 italic">No log output yet</span>}
      </pre>
    </div>
  )
}
