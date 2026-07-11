import { useEffect, useRef, useState } from 'react'
import type { ComponentStateView } from '../../context/AppContext'

interface LogsTabProps {
  projectName: string
  componentName: string
  processOrigin: ComponentStateView['processOrigin']
  directory: string
  hasServiceLog?: boolean
}

interface LogDataPayload {
  logFile: string
  content: string
  projectName?: string
  componentName?: string
}

export function LogsTab({
  projectName,
  componentName,
  processOrigin,
  directory,
  hasServiceLog = false
}: LogsTabProps): React.JSX.Element {
  const [content, setContent] = useState('')
  const [serviceLogChecked, setServiceLogChecked] = useState(false)
  const [hasReadableServiceLog, setHasReadableServiceLog] = useState(hasServiceLog)
  const containerRef = useRef<HTMLPreElement>(null)
  const autoScrollRef = useRef(true)

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    let tailStarted = false

    setServiceLogChecked(false)
    setHasReadableServiceLog(hasServiceLog)

    const appendOwnLogData = (data: LogDataPayload): void => {
      if (data.projectName || data.componentName) {
        if (data.projectName !== projectName || data.componentName !== componentName) return
      } else if (
        !data.logFile.startsWith(`${directory.replace(/\/+$/, '')}/`) ||
        !data.logFile.endsWith(`/${componentName}.log`)
      ) {
        return
      }

      setContent((prev) => prev + data.content)
    }

    const loadAndTailLog = async (): Promise<void> => {
      const log = await window.api.getLog(projectName, componentName)
      if (!active) return

      const canReadServiceLog = processOrigin !== 'external' || hasServiceLog || log.length > 0
      setHasReadableServiceLog(canReadServiceLog)
      setServiceLogChecked(true)

      if (!canReadServiceLog) {
        setContent('')
        return
      }

      setContent(log)

      const shouldTailLog = processOrigin === 'managed' || processOrigin === 'external'
      if (shouldTailLog) {
        unsubscribe = window.api.onLogData(appendOwnLogData)
        window.api.startLogTail(projectName, componentName, new TextEncoder().encode(log).length)
        tailStarted = true
      }
    }

    void loadAndTailLog()

    return () => {
      active = false
      unsubscribe?.()
      if (tailStarted) {
        window.api.stopLogTail(projectName, componentName)
      }
    }
  }, [projectName, componentName, processOrigin, hasServiceLog, directory])

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

  if (processOrigin === 'external' && serviceLogChecked && !hasReadableServiceLog) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <p className="text-[13px] text-zinc-400">No logs — external process</p>
        <p className="mt-1 max-w-xs text-[12px] text-zinc-600">
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
