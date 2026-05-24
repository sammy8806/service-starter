import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppState } from '../../context/AppContext'
import { isPortBound } from '../../../../shared/port-state'
import { sortServices, ProjectRow } from '../../utils/sortServices'
import { searchMatcher } from '../../utils/searchMatcher'
import { ActiveProjectsSection } from './ActiveProjectsSection'
import { IdleProjectsSection } from './IdleProjectsSection'
import { FooterActions } from './FooterActions'

interface FlatRow {
  id: string
  kind: 'project' | 'component'
  projectName: string
  componentName?: string
}

export function TrayDropdown(): React.JSX.Element {
  const ctx = useAppState()
  const { state } = ctx
  const searchRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collapsedActive, setCollapsedActive] = useState<Set<string>>(new Set())
  const [expandedIdle, setExpandedIdle] = useState<Set<string>>(new Set())
  const now = Date.now()

  const sections = useMemo(() => sortServices(state, state.favorites), [state])

  const filtered = useMemo(() => {
    const matchProject = (row: ProjectRow): ProjectRow | null => {
      if (searchQuery.trim() === '') return row
      const headerMatch = searchMatcher(searchQuery, {
        projectName: row.project.name,
        ports: row.components.flatMap((c) => c.component.ports.map((p) => p.port))
      })
      const comps = row.components.filter((c) =>
        searchMatcher(searchQuery, {
          projectName: row.project.name,
          componentName: c.component.name,
          ports: c.component.ports.map((p) => p.port)
        })
      )
      if (headerMatch) return row
      if (comps.length === 0) return null
      return { ...row, components: comps }
    }

    const active = sections.active.map(matchProject).filter((r): r is ProjectRow => r !== null)
    const idle = sections.idle.map(matchProject).filter((r): r is ProjectRow => r !== null)
    return { active, idle }
  }, [sections, searchQuery])

  const searching = searchQuery.trim() !== ''

  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = []
    for (const p of filtered.active) {
      rows.push({ id: p.project.name, kind: 'project', projectName: p.project.name })
      if (searching || !collapsedActive.has(p.project.name)) {
        for (const c of p.components) {
          rows.push({
            id: `${p.project.name}/${c.component.name}`,
            kind: 'component',
            projectName: p.project.name,
            componentName: c.component.name
          })
        }
      }
    }
    for (const p of filtered.idle) {
      rows.push({ id: p.project.name, kind: 'project', projectName: p.project.name })
      if (searching || expandedIdle.has(p.project.name)) {
        for (const c of p.components) {
          rows.push({
            id: `${p.project.name}/${c.component.name}`,
            kind: 'component',
            projectName: p.project.name,
            componentName: c.component.name
          })
        }
      }
    }
    return rows
  }, [filtered, collapsedActive, expandedIdle, searching])

  const allComponents = Object.values(state.projects).flatMap((p) => Object.values(p.components))
  const runningCount = allComponents.filter((c) => c.status === 'running').length
  const activePorts = new Set<number>()
  let totalPorts = 0
  for (const c of allComponents) {
    for (const port of c.ports) {
      totalPorts++
      if (isPortBound(port)) activePorts.add(port.port)
    }
  }

  function findProjectDir(projectName: string): string {
    return state.projects[projectName]?.directory ?? ''
  }

  function showComponentMenu(projectName: string, componentName: string): void {
    const component = state.projects[projectName]?.components[componentName]
    if (!component) return
    const port = component.ports[0]?.port
    const pid = component.ports.find((p) => typeof p.pid === 'number')?.pid
    const type =
      component.status === 'running'
        ? 'running-service'
        : component.ports.some((p) => p.status === 'conflict')
          ? 'conflict-service'
          : 'idle-service'
    ctx.showContextMenu(type, {
      projectName,
      projectDir: findProjectDir(projectName),
      componentName,
      port,
      pid
    })
  }

  function showProjectMenu(row: ProjectRow, active: boolean): void {
    ctx.showContextMenu(active ? 'active-project' : 'idle-project', {
      projectName: row.project.name,
      projectDir: row.project.directory
    })
  }

  function toggleActiveCollapsed(name: string): void {
    setCollapsedActive((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function toggleIdleExpanded(name: string): void {
    setExpandedIdle((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function moveSelection(delta: number): void {
    if (flatRows.length === 0) return
    const idx = flatRows.findIndex((r) => r.id === selectedId)
    const nextIdx = idx === -1 ? 0 : Math.max(0, Math.min(flatRows.length - 1, idx + delta))
    setSelectedId(flatRows[nextIdx].id)
  }

  function activateSelected(): void {
    const row = flatRows.find((r) => r.id === selectedId)
    if (!row) return
    if (row.kind === 'project') {
      const isActive = filtered.active.some((p) => p.project.name === row.projectName)
      isActive ? toggleActiveCollapsed(row.projectName) : toggleIdleExpanded(row.projectName)
      return
    }
    if (row.kind === 'component' && row.componentName) {
      const component = state.projects[row.projectName]?.components[row.componentName]
      if (component?.status === 'running') ctx.openDashboard()
      else if (component?.processOrigin === 'none') ctx.startComponent(row.projectName, row.componentName)
    }
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
      return
    }
    if (e.key === 'Escape') {
      if (searchQuery) {
        e.preventDefault()
        setSearchQuery('')
      } else {
        window.api.closeWindow()
      }
      return
    }
    if (isSearchFocused && e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveSelection(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveSelection(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      activateSelected()
    } else if (e.key === 's') {
      const row = flatRows.find((r) => r.id === selectedId)
      if (row?.kind === 'component' && row.componentName) {
        const component = state.projects[row.projectName]?.components[row.componentName]
        if (component?.processOrigin === 'none') ctx.startComponent(row.projectName, row.componentName)
      }
    } else if (e.key === 'x') {
      const row = flatRows.find((r) => r.id === selectedId)
      if (row?.kind === 'component' && row.componentName) {
        const component = state.projects[row.projectName]?.components[row.componentName]
        if (component?.status === 'running') showComponentMenu(row.projectName, row.componentName)
      }
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !isSearchFocused) {
      searchRef.current?.focus()
      setSearchQuery((q) => q + e.key)
    }
  }

  useEffect(() => {
    if (selectedId && !flatRows.some((r) => r.id === selectedId)) setSelectedId(null)
  }, [flatRows, selectedId])

  // Auto-resize the BrowserWindow to fit the rendered content height.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const sendHeight = (): void => window.api.resizeWindow(el.scrollHeight)
    const observer = new ResizeObserver(sendHeight)
    observer.observe(el)
    // Also sync on window focus (covers the show-before-first-resize-event race).
    window.addEventListener('focus', sendHeight)
    return () => {
      observer.disconnect()
      window.removeEventListener('focus', sendHeight)
    }
  }, [])

  const empty = Object.keys(state.projects).length === 0

  return (
    <div
      ref={containerRef}
      onKeyDown={onKeyDown}
      tabIndex={-1}
      className="w-[420px] max-h-[680px] flex flex-col bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-white/[0.08] shadow-2xl shadow-black/50 overflow-hidden outline-none"
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Services</span>
        <button onClick={ctx.openDashboard} className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors">
          Dashboard &rarr;
        </button>
      </div>

      {/* Stats + search — single thin row; input only visible when active */}
      <div className="flex items-center gap-2 px-3 py-0.5 border-b border-white/[0.06]">
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-500 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="font-mono tabular-nums text-zinc-400">{runningCount}</span> running
        </span>
        <input
          ref={searchRef}
          value={searchQuery}
          placeholder="Search…"
          spellCheck={false}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && searchQuery.length > 0) {
              e.preventDefault()
              e.stopPropagation()
              setSearchQuery('')
            }
          }}
          className={`min-w-0 bg-transparent text-[11px] text-zinc-300 placeholder:text-zinc-600 outline-none transition-all duration-150 ${
            isSearchFocused || searchQuery
              ? 'flex-1 opacity-100'
              : 'w-0 h-0 overflow-hidden opacity-0 pointer-events-none'
          }`}
        />
        <button
          onClick={() => searchRef.current?.focus()}
          title="Search (⌘F)"
          className="p-0.5 rounded text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0 ml-auto"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3M16.5 10.5a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
        {empty ? (
          <div className="px-3 py-8 text-center">
            <p className="text-[13px] text-zinc-500">No projects discovered</p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Add <span className="font-mono text-zinc-500">.service-starter.yml</span> to your projects
            </p>
          </div>
        ) : (
          <>
            <ActiveProjectsSection
              projects={filtered.active}
              selectedId={selectedId}
              now={now}
              collapsedProjects={collapsedActive}
              searching={searching}
              onToggleExpanded={toggleActiveCollapsed}
              onToggleFavorite={ctx.toggleFavorite}
              onStartComponent={ctx.startComponent}
              onStopComponent={ctx.stopComponent}
              onShowProjectMenu={(row) => showProjectMenu(row, true)}
              onShowComponentMenu={showComponentMenu}
            />
            <IdleProjectsSection
              projects={filtered.idle}
              expandedProjects={expandedIdle}
              searching={searching}
              selectedId={selectedId}
              now={now}
              onToggleExpanded={toggleIdleExpanded}
              onToggleFavorite={ctx.toggleFavorite}
              onStartComponent={ctx.startComponent}
              onStopComponent={ctx.stopComponent}
              onShowProjectMenu={(row) => showProjectMenu(row, false)}
              onShowComponentMenu={showComponentMenu}
            />
          </>
        )}
      </div>

      <FooterActions
        activePorts={activePorts.size}
        totalPorts={totalPorts}
        projectCount={Object.keys(state.projects).length}
        onShowMenu={() => ctx.showContextMenu('footer', { projectName: '' })}
      />
    </div>
  )
}
