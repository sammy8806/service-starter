import { useState } from 'react'
import { StatusBadge } from '../StatusBadge'
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

const ROW = 'w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors'

export function ProjectTree({ tree, selection, onSelect }: ProjectTreeProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(tree.map((p) => p.name)))

  const toggle = (name: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  return (
    <div className="w-60 flex-shrink-0 border-r border-white/[0.06] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 py-2">
      <button
        onClick={() => onSelect({ kind: 'overview' })}
        className={`${ROW} ${selection.kind === 'overview' ? 'bg-white/[0.06] text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
        Overview
      </button>

      <div className="my-2 border-t border-white/[0.04]" />

      {tree.map((project) => {
        const isCollapsed = collapsed.has(project.name)
        return (
          <div key={project.name}>
            <button
              onClick={() => {
                onSelect({ kind: 'project', projectName: project.name })
                toggle(project.name)
              }}
              className={`${ROW} ${isSelectedProject(selection, project.name) ? 'bg-white/[0.06] text-zinc-100' : 'text-zinc-300 hover:text-zinc-100'}`}
            >
              <svg
                className={`w-3 h-3 flex-shrink-0 text-zinc-500 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span className="flex-1 truncate">{project.name}</span>
              {project.hasConflict && <span aria-hidden className="text-amber-400 text-[11px]" title="Port conflict">⚠</span>}
              <span className="text-[11px] font-mono tabular-nums text-zinc-600">
                {project.runningCount}/{project.totalCount}
              </span>
            </button>

            {!isCollapsed &&
              project.components.map((comp) => (
                <button
                  key={comp.name}
                  onClick={() => onSelect({ kind: 'component', projectName: project.name, componentName: comp.name })}
                  className={`${ROW} pl-8 ${isSelectedComponent(selection, project.name, comp.name) ? 'bg-white/[0.06] text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  <StatusBadge status={comp.status} size="sm" />
                  <span className="flex-1 truncate">{comp.name}</span>
                  {comp.hasConflict && <span aria-hidden className="text-amber-400 text-[11px]" title="Port conflict">⚠</span>}
                  {comp.primaryPort !== undefined && (
                    <span className="text-[11px] font-mono tabular-nums text-zinc-600">:{comp.primaryPort}</span>
                  )}
                </button>
              ))}
          </div>
        )
      })}
    </div>
  )
}
