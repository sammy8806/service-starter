import { useMemo, useState } from 'react'
import type { AppStateView } from '../../context/AppContext'
import { useAppState } from '../../context/AppContext'
import { buildPatchbayRows, summarize } from '../../utils/patchbayRows'
import { hasDockerContent } from '../../utils/dockerDisplay'
import { DockerContainersSection } from './DockerContainersSection'
import { PatchbayHeader, type PatchbayFilter } from './PatchbayHeader'
import { PortRow } from './PortRow'
import { EmptyState } from './ui/EmptyState'

interface OverviewDetailProps {
  state: AppStateView
}

export function OverviewDetail({ state }: OverviewDetailProps): React.JSX.Element {
  const { startComponent, stopComponent, reassignPort } = useAppState()
  const [filter, setFilter] = useState<PatchbayFilter>('all')
  const rows = useMemo(() => buildPatchbayRows(state), [state])
  const summary = useMemo(() => summarize(state), [state])

  const visibleRows = useMemo(() => {
    if (filter === 'contested') {
      return rows.filter((row) => row.kind === 'contested' || row.kind === 'held')
    }
    if (filter === 'running') {
      return rows.filter((row) => row.kind === 'running' || row.kind === 'held')
    }
    return rows
  }, [filter, rows])

  const projectCount = Object.keys(state.projects).length
  const showDocker = hasDockerContent(state.docker)

  if (projectCount === 0 && !showDocker) {
    return (
      <EmptyState
        title="No projects discovered"
        description="Add scan directories in Settings and place .service-starter.yml manifests in your projects."
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PatchbayHeader summary={summary} filter={filter} onFilterChange={setFilter} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-zinc-600">
          Ports
        </div>
        {visibleRows.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12px] text-zinc-500">No matching ports</p>
        ) : (
          visibleRows.map((row) => (
            <PortRow
              key={row.port}
              row={row}
              allRows={rows}
              onRun={(projectName, componentName) => {
                void startComponent(projectName, componentName)
              }}
              onStop={(projectName, componentName) => {
                void stopComponent(projectName, componentName)
              }}
              onReassign={(projectName, componentName, label, fromPort, newPort) =>
                reassignPort(projectName, componentName, label, fromPort, newPort)
              }
            />
          ))
        )}

        {showDocker ? (
          <div className="px-5 pt-6">
            <DockerContainersSection docker={state.docker} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
