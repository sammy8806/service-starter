import { useMemo, useState, useEffect, useRef } from 'react'
import { StatusBadge } from '../StatusBadge'
import { searchMatcher } from '../../utils/searchMatcher'
import type { TreeProject } from '../../utils/dashboardTree'

export type Selection =
  | { kind: 'overview' }
  | { kind: 'project'; projectName: string }
  | { kind: 'component'; projectName: string; componentName: string }

interface ProjectTreeProps {
  tree: TreeProject[]
  selection: Selection
  onSelect: (selection: Selection) => void
}

function isSelectedProject(sel: Selection, name: string): boolean {
  return sel.kind === 'project' && sel.projectName === name
}

function isSelectedComponent(sel: Selection, project: string, component: string): boolean {
  return sel.kind === 'component' && sel.projectName === project && sel.componentName === component
}

function initialCollapsed(tree: TreeProject[]): Set<string> {
  return new Set(tree.filter((p) => p.runningCount === 0).map((p) => p.name))
}

const ROW =
  'w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors rounded-md mx-1'

export function ProjectTree({ tree, selection, onSelect }: ProjectTreeProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => initialCollapsed(tree))
  const seenProjects = useRef<Set<string>>(new Set())

  useEffect(() => {
    const newNames = tree.map((p) => p.name).filter((name) => !seenProjects.current.has(name))
    if (newNames.length === 0) return
    for (const name of newNames) seenProjects.current.add(name)
    setCollapsed((prev) => {
      const next = new Set(prev)
      for (const project of tree) {
        if (newNames.includes(project.name) && project.runningCount === 0) {
          next.add(project.name)
        }
      }
      return next
    })
  }, [tree])

  const filteredTree = useMemo(() => {
    const q = query.trim()
    if (!q) return tree

    return tree
      .map((project) => {
        const projectMatch = searchMatcher(q, {
          projectName: project.name,
          ports: project.components.flatMap((c) => (c.primaryPort !== undefined ? [c.primaryPort] : []))
        })
        const components = project.components.filter((c) =>
          searchMatcher(q, {
            projectName: project.name,
            componentName: c.name,
            ports: c.primaryPort !== undefined ? [c.primaryPort] : []
          })
        )
        if (projectMatch) return project
        if (components.length === 0) return null
        return { ...project, components }
      })
      .filter((p): p is TreeProject => p !== null)
  }, [tree, query])

  const toggle = (name: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const searching = query.trim() !== ''

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-white/[0.06] bg-zinc-900/50">
      <div className="border-b border-white/[0.06] p-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter projects…"
          aria-label="Filter projects"
          className="w-full rounded-md border border-white/[0.08] bg-zinc-800/80 px-2.5 py-1.5 text-[12px] text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <button
          onClick={() => onSelect({ kind: 'overview' })}
          className={`${ROW} ${selection.kind === 'overview' ? 'bg-white/[0.08] text-zinc-100' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'}`}
        >
          <svg
            className="h-3.5 w-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
            />
          </svg>
          Overview
        </button>

        <div className="mx-3 my-2 border-t border-white/[0.04]" />

        {filteredTree.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-zinc-600">No matching projects</p>
        ) : (
          filteredTree.map((project) => {
            const isCollapsed = !searching && collapsed.has(project.name)
            const selected = isSelectedProject(selection, project.name)

            return (
              <div key={project.name}>
                <div
                  className={`${ROW} pr-1 ${selected ? 'bg-white/[0.08] text-zinc-100' : 'text-zinc-300 hover:bg-white/[0.04]'}`}
                >
                  <button
                    type="button"
                    aria-label={isCollapsed ? `Expand ${project.name}` : `Collapse ${project.name}`}
                    onClick={() => toggle(project.name)}
                    className="shrink-0 rounded p-0.5 text-zinc-500 hover:text-zinc-300"
                  >
                    <svg
                      className={`h-3 w-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelect({ kind: 'project', projectName: project.name })}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="truncate">{project.name}</span>
                    {project.hasConflict && (
                      <span aria-hidden className="text-[11px] text-amber-400" title="Port conflict">
                        ⚠
                      </span>
                    )}
                    <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-zinc-600">
                      {project.runningCount}/{project.totalCount}
                    </span>
                  </button>
                </div>

                {!isCollapsed &&
                  project.components.map((comp) => (
                    <button
                      key={comp.name}
                      type="button"
                      aria-label={`${comp.name} component`}
                      onClick={() =>
                        onSelect({ kind: 'component', projectName: project.name, componentName: comp.name })
                      }
                      className={`${ROW} pl-9 ${isSelectedComponent(selection, project.name, comp.name) ? 'bg-white/[0.08] text-zinc-100' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'}`}
                    >
                      <StatusBadge status={comp.status} size="sm" />
                      <span className="truncate">{comp.name}</span>
                      {comp.hasConflict && (
                        <span aria-hidden className="text-[11px] text-amber-400" title="Port conflict">
                          ⚠
                        </span>
                      )}
                      {comp.primaryPort !== undefined && (
                        <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-zinc-600">
                          :{comp.primaryPort}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
