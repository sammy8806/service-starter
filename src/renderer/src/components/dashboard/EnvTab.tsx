import { useEffect, useState } from 'react'

interface EnvTabProps {
  projectName: string
  componentName: string
}

export function EnvTab({ projectName, componentName }: EnvTabProps): React.JSX.Element {
  const [env, setEnv] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    let active = true
    window.api.getComponentEnv(projectName, componentName).then((result) => {
      if (active) setEnv(result)
    })
    return () => {
      active = false
    }
  }, [projectName, componentName])

  if (env === null) {
    return <div className="p-5 text-[13px] text-zinc-500">Loading…</div>
  }

  const entries = Object.entries(env)
  if (entries.length === 0) {
    return <div className="p-5 text-[13px] text-zinc-500">No environment variables declared</div>
  }

  return (
    <div className="p-5">
      <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.04] font-mono text-[12px]">
        {entries.map(([key, value]) => (
          <div key={key} className="flex gap-3 px-4 py-2">
            <span className="text-zinc-400 flex-shrink-0">{key}</span>
            <span className="text-zinc-300 break-all">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
