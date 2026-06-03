# Dashboard Window Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the dashboard window into a master/detail "deep view" — a project/component tree on the left, a routed detail panel (Overview / project / component-with-tabs) on the right — and a fully reworked Settings surface, without touching the tray.

**Architecture:** A single `DashboardWindow` shell owns the top nav (`Projects · Settings`), the tree selection, and routes the right panel. Cross-project port/conflict data lives in an Overview detail; per-component Logs/Ports/Deps/Env live in tabs. Two additive main-process IPC handlers (native folder picker, resolved component env) are the only `src/main` changes besides making the window resizable and deleting absorbed files.

**Tech Stack:** Electron 39, React 19, TypeScript, Tailwind 3, Vitest + Testing Library. Renderer talks to main via the preload `window.api` bridge.

**Spec:** `docs/superpowers/specs/2026-06-04-dashboard-rework-design.md`

**Conventions to follow (read before starting):**
- Components live in `src/renderer/src/components/dashboard/`. One component per file, named export, `: React.JSX.Element` return type.
- State comes from `useAppState()` (`src/renderer/src/context/AppContext.tsx`) → `AppStateView`. Reuse `StatusBadge` from `src/renderer/src/components/StatusBadge.tsx`.
- Components needing main-process calls use `window.api.*` directly (see `LogViewer.tsx` for the pattern) — don't bloat `AppContext` unless multiple components share the call.
- Tailwind palette matches the tray: `bg-zinc-900`, `text-zinc-300/400/500`, borders `border-white/[0.06]`, selection `bg-white/[0.06]`.
- Tests: Vitest + `@testing-library/react`. `vitest.setup.ts` already wires jest-dom + cleanup. Run a single test with `npx vitest run <path>`.
- Run `npm run typecheck` after main/preload changes.

---

## File Structure

**New (renderer):**
- `src/renderer/src/components/dashboard/DashboardWindow.tsx` (reworked) — shell, nav, selection, routing
- `src/renderer/src/components/dashboard/ProjectTree.tsx` — left panel
- `src/renderer/src/components/dashboard/OverviewDetail.tsx` — KPI + conflicts + global port map
- `src/renderer/src/components/dashboard/ProjectDetail.tsx` — project rollup
- `src/renderer/src/components/dashboard/ComponentDetail.tsx` — header + detail tabs
- `src/renderer/src/components/dashboard/LogsTab.tsx` — inline live log tail
- `src/renderer/src/components/dashboard/PortsTab.tsx` — scoped ports
- `src/renderer/src/components/dashboard/DepsTab.tsx` — scoped dependency health
- `src/renderer/src/components/dashboard/EnvTab.tsx` — resolved env vars
- `src/renderer/src/components/dashboard/SettingsView.tsx` (reworked from `SettingsTab.tsx`)
- `src/renderer/src/utils/dashboardTree.ts` — pure tree builder (+ test)
- `src/renderer/src/utils/dashboardStats.ts` — pure KPI computation (+ test)

**Modified (main/preload):**
- `src/main/ipc/channels.ts` — two new channels
- `src/main/ipc/handlers.ts` — two new handlers + deps
- `src/main/index.ts` — wire deps, make window resizable
- `src/preload/index.ts` + `src/preload/index.d.ts` — two new API methods

**Deleted (absorbed):**
- `ProjectsTab.tsx`, `PortMapTab.tsx`, `DependenciesTab.tsx`, `ConflictWarningBanner.tsx`, `LogViewer.tsx`

---

## Task 1: IPC — native folder picker

**Files:**
- Modify: `src/main/ipc/channels.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

- [ ] **Step 1: Add the channel name**

In `src/main/ipc/channels.ts`, inside the `IPC_CHANNELS` object, after the `SHOW_CONTEXT_MENU: 'menu:show'` line add a trailing comma and these lines (before the closing `} as const`):

```ts
  SHOW_CONTEXT_MENU: 'menu:show',

  // Dashboard
  DIALOG_SELECT_DIRECTORY: 'dialog:select-directory',
  COMPONENT_GET_ENV: 'component:get-env'
```

- [ ] **Step 2: Add the handler dependency + registration**

In `src/main/ipc/handlers.ts`, add to the `HandlerDependencies` interface (after `tailLogs`):

```ts
  selectDirectory: () => Promise<string | null>
  getComponentEnv: (projectName: string, componentName: string) => Record<string, string>
```

Then at the end of `registerIpcHandlers`, after the `TAIL_LOGS` handler block (before the closing `}`):

```ts
  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY, () => {
    return deps.selectDirectory()
  })

  ipcMain.handle(IPC_CHANNELS.COMPONENT_GET_ENV, (_event, projectName: string, componentName: string) => {
    return deps.getComponentEnv(projectName, componentName)
  })
```

- [ ] **Step 3: Wire the deps in main**

In `src/main/index.ts`: confirm `dialog` is already imported from `electron` (it is, line 1). Add an import for the env resolver near the other config imports:

```ts
import { resolveEnvVars } from './config/env-resolver'
```

Find the `registerIpcHandlers({ ... })` call and add these two properties to the object passed in:

```ts
    selectDirectory: async () => {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    },
    getComponentEnv: (projectName: string, componentName: string) => {
      for (const project of projectRegistry.getProjects().values()) {
        if (project.name === projectName) {
          const env = project.components[componentName]?.env
          return env ? resolveEnvVars(env).resolved : {}
        }
      }
      return {}
    },
```

- [ ] **Step 4: Expose in preload**

In `src/preload/index.ts`, inside the `api` object, after the `showContextMenu` line add:

```ts
  showContextMenu: (type: string, payload: unknown) =>
    ipcRenderer.send('menu:show', type, payload),

  // Dashboard
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  getComponentEnv: (projectName: string, componentName: string) =>
    ipcRenderer.invoke('component:get-env', projectName, componentName),
```

- [ ] **Step 5: Type the preload API**

In `src/preload/index.d.ts`, add to the `ServiceStarterAPI` interface (after `showContextMenu`):

```ts
  selectDirectory: () => Promise<string | null>
  getComponentEnv: (projectName: string, componentName: string) => Promise<Record<string, string>>
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 7: Commit**

```bash
git add src/main/ipc/channels.ts src/main/ipc/handlers.ts src/main/index.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: add folder-picker and component-env IPC for dashboard"
```

---

## Task 2: Pure util — dashboard tree builder

Builds the ordered project/component tree for the left panel from `AppStateView`, with conflict flags that bubble from component → project.

**Files:**
- Create: `src/renderer/src/utils/dashboardTree.ts`
- Test: `src/renderer/src/utils/dashboardTree.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/src/utils/dashboardTree.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildDashboardTree } from './dashboardTree'
import type { AppStateView, ComponentStateView } from '../context/AppContext'

function comp(name: string, over: Partial<ComponentStateView> = {}): ComponentStateView {
  return {
    name,
    status: 'stopped',
    processOrigin: 'none',
    ports: [],
    dependencies: [],
    ...over
  }
}

function state(projects: AppStateView['projects']): AppStateView {
  return { projects, trayIcon: 'grey', conflicts: [], favorites: [] }
}

describe('buildDashboardTree', () => {
  it('orders projects and components alphabetically', () => {
    const tree = buildDashboardTree(
      state({
        zebra: { name: 'zebra', directory: '/z', dependencies: [], components: { b: comp('b'), a: comp('a') } },
        apple: { name: 'apple', directory: '/a', dependencies: [], components: {} }
      })
    )
    expect(tree.map((p) => p.name)).toEqual(['apple', 'zebra'])
    expect(tree[1].components.map((c) => c.name)).toEqual(['a', 'b'])
  })

  it('counts running components', () => {
    const tree = buildDashboardTree(
      state({
        p: {
          name: 'p',
          directory: '/p',
          dependencies: [],
          components: { a: comp('a', { status: 'running' }), b: comp('b') }
        }
      })
    )
    expect(tree[0].runningCount).toBe(1)
    expect(tree[0].totalCount).toBe(2)
  })

  it('flags conflicts on the component and bubbles to the project', () => {
    const tree = buildDashboardTree(
      state({
        p: {
          name: 'p',
          directory: '/p',
          dependencies: [],
          components: {
            a: comp('a', { ports: [{ port: 3000, label: 'web', status: 'conflict' }] }),
            b: comp('b', { ports: [{ port: 4000, label: 'api', status: 'in-use' }] })
          }
        }
      })
    )
    expect(tree[0].hasConflict).toBe(true)
    expect(tree[0].components.find((c) => c.name === 'a')!.hasConflict).toBe(true)
    expect(tree[0].components.find((c) => c.name === 'b')!.hasConflict).toBe(false)
  })

  it('exposes the first port as the component port hint', () => {
    const tree = buildDashboardTree(
      state({
        p: {
          name: 'p',
          directory: '/p',
          dependencies: [],
          components: { a: comp('a', { ports: [{ port: 8090, label: 'api', status: 'in-use' }] }) }
        }
      })
    )
    expect(tree[0].components[0].primaryPort).toBe(8090)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/utils/dashboardTree.test.ts`
Expected: FAIL — `buildDashboardTree` is not defined / module not found.

- [ ] **Step 3: Write the implementation**

Create `src/renderer/src/utils/dashboardTree.ts`:

```ts
import type { AppStateView, ComponentStateView } from '../context/AppContext'

export interface TreeComponent {
  name: string
  status: ComponentStateView['status']
  processOrigin: ComponentStateView['processOrigin']
  hasConflict: boolean
  primaryPort?: number
}

export interface TreeProject {
  name: string
  directory: string
  components: TreeComponent[]
  hasConflict: boolean
  runningCount: number
  totalCount: number
}

/** Builds the ordered project/component tree for the dashboard left panel. */
export function buildDashboardTree(state: AppStateView): TreeProject[] {
  const projects = Object.values(state.projects).map((project) => {
    const components = Object.values(project.components)
      .map((c): TreeComponent => ({
        name: c.name,
        status: c.status,
        processOrigin: c.processOrigin,
        hasConflict: c.ports.some((p) => p.status === 'conflict'),
        primaryPort: c.ports[0]?.port
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return {
      name: project.name,
      directory: project.directory,
      components,
      hasConflict: components.some((c) => c.hasConflict),
      runningCount: components.filter((c) => c.status === 'running').length,
      totalCount: components.length
    }
  })

  return projects.sort((a, b) => a.name.localeCompare(b.name))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/utils/dashboardTree.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/utils/dashboardTree.ts src/renderer/src/utils/dashboardTree.test.ts
git commit -m "feat: add dashboard tree builder util"
```

---

## Task 3: Pure util — dashboard KPIs

Computes the Overview KPI numbers (running count, ports, conflicts) from state.

**Files:**
- Create: `src/renderer/src/utils/dashboardStats.ts`
- Test: `src/renderer/src/utils/dashboardStats.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/src/utils/dashboardStats.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeKpis } from './dashboardStats'
import type { AppStateView } from '../context/AppContext'

function state(over: Partial<AppStateView> = {}): AppStateView {
  return { projects: {}, trayIcon: 'grey', conflicts: [], favorites: [], ...over }
}

describe('computeKpis', () => {
  it('returns zeros for empty state', () => {
    expect(computeKpis(state())).toEqual({ running: 0, totalPorts: 0, activePorts: 0, conflicts: 0 })
  })

  it('counts running components, ports, active ports, and conflicts', () => {
    const s = state({
      conflicts: [{ port: 3000, type: 'static', claimants: ['a/web', 'b/web'] }],
      projects: {
        p: {
          name: 'p',
          directory: '/p',
          dependencies: [],
          components: {
            web: {
              name: 'web',
              status: 'running',
              processOrigin: 'managed',
              dependencies: [],
              ports: [
                { port: 3000, label: 'web', status: 'in-use' },
                { port: 9229, label: 'debug', status: 'free' }
              ]
            }
          }
        }
      }
    })
    expect(computeKpis(s)).toEqual({ running: 1, totalPorts: 2, activePorts: 1, conflicts: 1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/utils/dashboardStats.test.ts`
Expected: FAIL — `computeKpis` is not defined.

- [ ] **Step 3: Write the implementation**

Create `src/renderer/src/utils/dashboardStats.ts`:

```ts
import type { AppStateView } from '../context/AppContext'

export interface DashboardKpis {
  running: number
  totalPorts: number
  activePorts: number
  conflicts: number
}

/** Aggregates running/port/conflict counts for the Overview KPI header. */
export function computeKpis(state: AppStateView): DashboardKpis {
  let running = 0
  let totalPorts = 0
  let activePorts = 0

  for (const project of Object.values(state.projects)) {
    for (const comp of Object.values(project.components)) {
      if (comp.status === 'running') running++
      for (const port of comp.ports) {
        totalPorts++
        if (port.status === 'in-use' || port.status === 'conflict') activePorts++
      }
    }
  }

  return { running, totalPorts, activePorts, conflicts: state.conflicts.length }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/utils/dashboardStats.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/utils/dashboardStats.ts src/renderer/src/utils/dashboardStats.test.ts
git commit -m "feat: add dashboard KPI computation util"
```

---

## Task 4: ProjectTree component

Left panel: pinned Overview node + alphabetical projects with expandable components, conflict badges, selection highlight.

**Files:**
- Create: `src/renderer/src/components/dashboard/ProjectTree.tsx`
- Test: `src/renderer/src/components/dashboard/ProjectTree.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/src/components/dashboard/ProjectTree.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectTree } from './ProjectTree'
import type { TreeProject } from '../../utils/dashboardTree'

const tree: TreeProject[] = [
  {
    name: 'shop',
    directory: '/shop',
    hasConflict: true,
    runningCount: 1,
    totalCount: 2,
    components: [
      { name: 'backend', status: 'running', processOrigin: 'managed', hasConflict: false, primaryPort: 8090 },
      { name: 'web', status: 'stopped', processOrigin: 'none', hasConflict: true, primaryPort: 3000 }
    ]
  }
]

describe('ProjectTree', () => {
  it('renders the Overview node and selects it on click', () => {
    const onSelect = vi.fn()
    render(<ProjectTree tree={tree} selection={{ kind: 'project', projectName: 'shop' }} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Overview'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'overview' })
  })

  it('expands a project to reveal components and selects one', () => {
    const onSelect = vi.fn()
    render(<ProjectTree tree={tree} selection={{ kind: 'overview' }} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('shop'))
    fireEvent.click(screen.getByText('backend'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'component', projectName: 'shop', componentName: 'backend' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/dashboard/ProjectTree.test.tsx`
Expected: FAIL — cannot find `./ProjectTree`.

- [ ] **Step 3: Write the implementation**

Create `src/renderer/src/components/dashboard/ProjectTree.tsx`:

```tsx
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (name: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })

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
              {project.hasConflict && <span className="text-amber-400 text-[11px]" title="Port conflict">⚠</span>}
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
                  {comp.hasConflict && <span className="text-amber-400 text-[11px]" title="Port conflict">⚠</span>}
                  {comp.primaryPort && (
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/dashboard/ProjectTree.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/dashboard/ProjectTree.tsx src/renderer/src/components/dashboard/ProjectTree.test.tsx
git commit -m "feat: add dashboard ProjectTree left panel"
```

---

## Task 5: OverviewDetail component

The home detail: KPI header, cross-project conflicts table, global port map. Absorbs `PortMapTab` + `ConflictWarningBanner`.

**Files:**
- Create: `src/renderer/src/components/dashboard/OverviewDetail.tsx`
- Test: `src/renderer/src/components/dashboard/OverviewDetail.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/src/components/dashboard/OverviewDetail.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverviewDetail } from './OverviewDetail'
import type { AppStateView } from '../../context/AppContext'

const state: AppStateView = {
  trayIcon: 'green',
  favorites: [],
  conflicts: [{ port: 3000, type: 'static', claimants: ['shop/web', 'blog/web'] }],
  projects: {
    shop: {
      name: 'shop',
      directory: '/shop',
      dependencies: [],
      components: {
        web: {
          name: 'web',
          status: 'running',
          processOrigin: 'managed',
          dependencies: [],
          ports: [{ port: 3000, label: 'web', status: 'conflict', process: 'node', pid: 4821 }]
        }
      }
    }
  }
}

describe('OverviewDetail', () => {
  it('shows KPI counts', () => {
    render(<OverviewDetail state={state} />)
    expect(screen.getByText('1', { selector: '*' })).toBeTruthy()
    expect(screen.getByText(/running/i)).toBeInTheDocument()
  })

  it('lists conflicts and the global port map row', () => {
    render(<OverviewDetail state={state} />)
    expect(screen.getByText(/:3000/)).toBeInTheDocument()
    expect(screen.getByText('shop')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/dashboard/OverviewDetail.test.tsx`
Expected: FAIL — cannot find `./OverviewDetail`.

- [ ] **Step 3: Write the implementation**

Create `src/renderer/src/components/dashboard/OverviewDetail.tsx`:

```tsx
import type { AppStateView } from '../../context/AppContext'
import { computeKpis } from '../../utils/dashboardStats'

interface OverviewDetailProps {
  state: AppStateView
}

interface PortRow {
  port: number
  label: string
  status: string
  project: string
  component: string
  process?: string
  pid?: number
}

function buildPortRows(state: AppStateView): PortRow[] {
  const rows: PortRow[] = []
  for (const project of Object.values(state.projects)) {
    for (const [compName, comp] of Object.entries(project.components)) {
      for (const port of comp.ports) {
        rows.push({
          port: port.port,
          label: port.label,
          status: port.status,
          project: project.name,
          component: compName,
          process: port.process,
          pid: port.pid
        })
      }
    }
  }
  return rows.sort((a, b) => a.port - b.port)
}

function Kpi({ value, label, accent }: { value: number; label: string; accent?: string }): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <span className={`text-[20px] font-semibold tabular-nums ${accent ?? 'text-zinc-100'}`}>{value}</span>
      <span className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
    </div>
  )
}

export function OverviewDetail({ state }: OverviewDetailProps): React.JSX.Element {
  const kpis = computeKpis(state)
  const portRows = buildPortRows(state)

  return (
    <div className="p-5 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
      <div className="flex gap-10">
        <Kpi value={kpis.running} label="Running" accent="text-emerald-400" />
        <Kpi value={kpis.activePorts} label={`/ ${kpis.totalPorts} Ports`} />
        <Kpi value={kpis.conflicts} label="Conflicts" accent={kpis.conflicts > 0 ? 'text-amber-400' : undefined} />
      </div>

      {state.conflicts.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/80 mb-2">
            Port Conflicts
          </h3>
          <div className="rounded-lg border border-amber-500/20 bg-amber-400/[0.03] divide-y divide-white/[0.04]">
            {state.conflicts.map((c) => (
              <div key={c.port} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className="font-mono tabular-nums text-amber-400">:{c.port}</span>
                <span className="text-zinc-400">{c.claimants.join(', ')}</span>
                {c.activeProcess && (
                  <span className="ml-auto font-mono text-[11px] text-zinc-500">
                    {c.activeProcess}{c.activePid ? ` (${c.activePid})` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Port Map</h3>
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 bg-zinc-800/50">
                <th className="px-4 py-2.5 font-medium">Port</th>
                <th className="px-4 py-2.5 font-medium">Label</th>
                <th className="px-4 py-2.5 font-medium">Project</th>
                <th className="px-4 py-2.5 font-medium">Component</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Process</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {portRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No ports declared</td>
                </tr>
              ) : (
                portRows.map((row) => (
                  <tr
                    key={`${row.project}/${row.component}/${row.port}`}
                    className={`hover:bg-white/[0.02] transition-colors ${row.status === 'conflict' ? 'bg-amber-400/[0.03]' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-mono tabular-nums text-zinc-300">:{row.port}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{row.label}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{row.project}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{row.component}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        row.status === 'conflict' ? 'bg-amber-500/10 text-amber-400' :
                        row.status === 'in-use' ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-zinc-700/50 text-zinc-400'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500">
                      {row.process ? `${row.process} (${row.pid})` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/dashboard/OverviewDetail.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/dashboard/OverviewDetail.tsx src/renderer/src/components/dashboard/OverviewDetail.test.tsx
git commit -m "feat: add dashboard OverviewDetail (KPIs, conflicts, port map)"
```

---

## Task 6: LogsTab component

Inline live log tail replacing the `LogViewer` modal. Shows an empty state for external/unmanaged components (no log file).

**Files:**
- Create: `src/renderer/src/components/dashboard/LogsTab.tsx`
- Test: `src/renderer/src/components/dashboard/LogsTab.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/src/components/dashboard/LogsTab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { LogsTab } from './LogsTab'

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getLog: vi.fn().mockResolvedValue('line one\nline two\n'),
    startLogTail: vi.fn(),
    stopLogTail: vi.fn(),
    onLogData: vi.fn().mockReturnValue(() => {})
  }
})

describe('LogsTab', () => {
  it('shows the external empty state for non-managed components', () => {
    render(<LogsTab projectName="p" componentName="c" processOrigin="external" />)
    expect(screen.getByText(/external process/i)).toBeInTheDocument()
    expect(window.api.getLog).not.toHaveBeenCalled()
  })

  it('loads and renders initial log content for managed components', async () => {
    render(<LogsTab projectName="p" componentName="c" processOrigin="managed" />)
    await waitFor(() => expect(screen.getByText(/line one/)).toBeInTheDocument())
    expect(window.api.startLogTail).toHaveBeenCalledWith('p', 'c')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/dashboard/LogsTab.test.tsx`
Expected: FAIL — cannot find `./LogsTab`.

- [ ] **Step 3: Write the implementation**

Create `src/renderer/src/components/dashboard/LogsTab.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { ComponentStateView } from '../../context/AppContext'

interface LogsTabProps {
  projectName: string
  componentName: string
  processOrigin: ComponentStateView['processOrigin']
}

export function LogsTab({ projectName, componentName, processOrigin }: LogsTabProps): React.JSX.Element {
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
    const unsubscribe = window.api.onLogData((data) => setContent((prev) => prev + data.content))
    return () => {
      active = false
      unsubscribe()
      window.api.stopLogTail(projectName, componentName)
    }
  }, [projectName, componentName, hasLogs])

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
          onClick={() => navigator.clipboard.writeText(content)}
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/dashboard/LogsTab.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/dashboard/LogsTab.tsx src/renderer/src/components/dashboard/LogsTab.test.tsx
git commit -m "feat: add dashboard LogsTab inline live tail"
```

---

## Task 7: PortsTab, DepsTab, EnvTab (scoped component detail tabs)

Three small presentational tabs scoped to a single component.

**Files:**
- Create: `src/renderer/src/components/dashboard/PortsTab.tsx`
- Create: `src/renderer/src/components/dashboard/DepsTab.tsx`
- Create: `src/renderer/src/components/dashboard/EnvTab.tsx`
- Test: `src/renderer/src/components/dashboard/EnvTab.test.tsx`

- [ ] **Step 1: Write PortsTab**

Create `src/renderer/src/components/dashboard/PortsTab.tsx`:

```tsx
import type { ComponentStateView } from '../../context/AppContext'

export function PortsTab({ component }: { component: ComponentStateView }): React.JSX.Element {
  if (component.ports.length === 0) {
    return <div className="p-5 text-[13px] text-zinc-500">No ports declared</div>
  }
  return (
    <div className="p-5">
      <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]">
        {component.ports.map((port) => (
          <div key={port.port} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
            <span className={`font-mono tabular-nums ${
              port.status === 'conflict' ? 'text-amber-400' :
              port.status === 'in-use' ? 'text-emerald-400' : 'text-zinc-500'
            }`}>:{port.port}</span>
            <span className="text-zinc-400">{port.label}</span>
            <span className="ml-auto text-[11px] text-zinc-500">{port.status}</span>
            {port.process && (
              <span className="font-mono text-[11px] text-zinc-600">{port.process} ({port.pid})</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write DepsTab**

Create `src/renderer/src/components/dashboard/DepsTab.tsx`:

```tsx
import type { ComponentStateView } from '../../context/AppContext'
import { StatusBadge } from '../StatusBadge'

export function DepsTab({ component }: { component: ComponentStateView }): React.JSX.Element {
  if (component.dependencies.length === 0) {
    return <div className="p-5 text-[13px] text-zinc-500">No dependencies configured</div>
  }
  return (
    <div className="p-5">
      <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]">
        {component.dependencies.map((dep, i) => {
          const name = dep.dependency.name ?? dep.dependency.container ?? 'unknown'
          return (
            <div key={`${name}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <StatusBadge
                status={dep.health === 'healthy' ? 'healthy' : dep.health === 'unhealthy' ? 'unhealthy' : 'unknown'}
                size="md"
              />
              <span className="text-zinc-300 font-medium">{name}</span>
              <span className="text-[11px] text-zinc-600">{dep.dependency.type}</span>
              <span className={`ml-auto text-[12px] font-medium ${
                dep.health === 'healthy' ? 'text-emerald-400' :
                dep.health === 'unhealthy' ? 'text-red-400' : 'text-zinc-500'
              }`}>{dep.health}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write the failing EnvTab test**

Create `src/renderer/src/components/dashboard/EnvTab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { EnvTab } from './EnvTab'

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getComponentEnv: vi.fn().mockResolvedValue({ NODE_ENV: 'development', PORT: '3000' })
  }
})

describe('EnvTab', () => {
  it('loads and renders resolved env vars', async () => {
    render(<EnvTab projectName="p" componentName="c" />)
    await waitFor(() => expect(screen.getByText('NODE_ENV')).toBeInTheDocument())
    expect(screen.getByText('development')).toBeInTheDocument()
    expect(window.api.getComponentEnv).toHaveBeenCalledWith('p', 'c')
  })

  it('shows an empty state when there are no env vars', async () => {
    ;(window.api.getComponentEnv as ReturnType<typeof vi.fn>).mockResolvedValue({})
    render(<EnvTab projectName="p" componentName="c" />)
    await waitFor(() => expect(screen.getByText(/no environment variables/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 4: Run EnvTab test to verify it fails**

Run: `npx vitest run src/renderer/src/components/dashboard/EnvTab.test.tsx`
Expected: FAIL — cannot find `./EnvTab`.

- [ ] **Step 5: Write EnvTab**

Create `src/renderer/src/components/dashboard/EnvTab.tsx`:

```tsx
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
```

- [ ] **Step 6: Run EnvTab test to verify it passes**

Run: `npx vitest run src/renderer/src/components/dashboard/EnvTab.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/dashboard/PortsTab.tsx src/renderer/src/components/dashboard/DepsTab.tsx src/renderer/src/components/dashboard/EnvTab.tsx src/renderer/src/components/dashboard/EnvTab.test.tsx
git commit -m "feat: add scoped Ports/Deps/Env detail tabs"
```

---

## Task 8: ComponentDetail component

Header (name, status, uptime, pid, port, Start/Stop/Restart) + the four detail tabs.

**Files:**
- Create: `src/renderer/src/components/dashboard/ComponentDetail.tsx`
- Test: `src/renderer/src/components/dashboard/ComponentDetail.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/src/components/dashboard/ComponentDetail.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComponentDetail } from './ComponentDetail'
import type { ComponentStateView } from '../../context/AppContext'

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getComponentEnv: vi.fn().mockResolvedValue({}),
    getLog: vi.fn().mockResolvedValue(''),
    startLogTail: vi.fn(),
    stopLogTail: vi.fn(),
    onLogData: vi.fn().mockReturnValue(() => {})
  }
})

const managed: ComponentStateView = {
  name: 'backend',
  status: 'running',
  processOrigin: 'managed',
  dependencies: [],
  ports: [{ port: 8090, label: 'api', status: 'in-use', pid: 4821 }]
}

describe('ComponentDetail', () => {
  it('renders the component header and a Stop action for a managed running service', () => {
    render(
      <ComponentDetail
        projectName="shop"
        component={managed}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRestart={vi.fn()}
      />
    )
    expect(screen.getByText('backend')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('switches to the Ports tab when clicked', () => {
    render(
      <ComponentDetail
        projectName="shop"
        component={managed}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRestart={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ports' }))
    expect(screen.getByText('api')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/dashboard/ComponentDetail.test.tsx`
Expected: FAIL — cannot find `./ComponentDetail`.

- [ ] **Step 3: Write the implementation**

Create `src/renderer/src/components/dashboard/ComponentDetail.tsx`:

```tsx
import { useState } from 'react'
import type { ComponentStateView } from '../../context/AppContext'
import { StatusBadge } from '../StatusBadge'
import { formatUptime } from '../../utils/formatUptime'
import { LogsTab } from './LogsTab'
import { PortsTab } from './PortsTab'
import { DepsTab } from './DepsTab'
import { EnvTab } from './EnvTab'

type DetailTab = 'logs' | 'ports' | 'deps' | 'env'

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'logs', label: 'Logs' },
  { id: 'ports', label: 'Ports' },
  { id: 'deps', label: 'Deps' },
  { id: 'env', label: 'Env' }
]

interface ComponentDetailProps {
  projectName: string
  component: ComponentStateView
  onStart: (projectName: string, componentName: string) => void
  onStop: (projectName: string, componentName: string) => void
  onRestart: (projectName: string, componentName: string) => void
}

export function ComponentDetail({
  projectName,
  component,
  onStart,
  onStop,
  onRestart
}: ComponentDetailProps): React.JSX.Element {
  const [tab, setTab] = useState<DetailTab>('logs')
  const pid = component.ports.find((p) => typeof p.pid === 'number')?.pid
  const port = component.ports[0]?.port
  const isManaged = component.processOrigin === 'managed'
  const isRunning = component.status === 'running'

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <StatusBadge status={component.status} size="md" />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-zinc-100">{component.name}</div>
          <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
            {port ? `:${port}` : ''}
            {component.startedAt ? ` · ${formatUptime(component.startedAt, Date.now())}` : ''}
            {pid ? ` · pid ${pid}` : ''}
            {` · ${component.processOrigin}`}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isManaged && isRunning && (
            <button
              onClick={() => onRestart(projectName, component.name)}
              className="px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              Restart
            </button>
          )}
          {isRunning && isManaged ? (
            <button
              onClick={() => onStop(projectName, component.name)}
              className="px-3 py-1.5 text-[12px] text-red-400/80 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            >
              Stop
            </button>
          ) : component.processOrigin === 'none' ? (
            <button
              onClick={() => onStart(projectName, component.name)}
              className="px-3 py-1.5 text-[12px] text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
            >
              Start
            </button>
          ) : null}
        </div>
      </div>

      {/* Tab bar */}
      <nav className="flex gap-0 px-5 border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-[13px] font-medium transition-colors relative ${
              tab === t.id ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
            {tab === t.id && <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-zinc-100 rounded-full" />}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="flex flex-1 flex-col min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
        {tab === 'logs' && (
          <LogsTab projectName={projectName} componentName={component.name} processOrigin={component.processOrigin} />
        )}
        {tab === 'ports' && <PortsTab component={component} />}
        {tab === 'deps' && <DepsTab component={component} />}
        {tab === 'env' && <EnvTab projectName={projectName} componentName={component.name} />}
      </div>
    </div>
  )
}
```

Note: `formatUptime` already exists at `src/renderer/src/utils/formatUptime.ts` with signature `formatUptime(startedAt: number | undefined, now?: number): string` — the `formatUptime(component.startedAt, Date.now())` call above is correct as written.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/dashboard/ComponentDetail.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/dashboard/ComponentDetail.tsx src/renderer/src/components/dashboard/ComponentDetail.test.tsx
git commit -m "feat: add dashboard ComponentDetail with detail tabs"
```

---

## Task 9: ProjectDetail component

Project rollup: header with running counts + Start all / Stop all, aggregate ports, project-level deps, links into each component's logs.

**Files:**
- Create: `src/renderer/src/components/dashboard/ProjectDetail.tsx`
- Test: `src/renderer/src/components/dashboard/ProjectDetail.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/src/components/dashboard/ProjectDetail.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectDetail } from './ProjectDetail'
import type { ProjectStateView } from '../../context/AppContext'

const project: ProjectStateView = {
  name: 'shop',
  directory: '/shop',
  dependencies: [],
  components: {
    backend: {
      name: 'backend',
      status: 'running',
      processOrigin: 'managed',
      dependencies: [],
      ports: [{ port: 8090, label: 'api', status: 'in-use' }]
    },
    web: { name: 'web', status: 'stopped', processOrigin: 'none', dependencies: [], ports: [] }
  }
}

describe('ProjectDetail', () => {
  it('shows the running rollup and Start all / Stop all', () => {
    render(
      <ProjectDetail project={project} onStartProject={vi.fn()} onStopProject={vi.fn()} onSelectComponent={vi.fn()} />
    )
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start all/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stop all/i })).toBeInTheDocument()
  })

  it('selects a component when its row is clicked', () => {
    const onSelectComponent = vi.fn()
    render(
      <ProjectDetail
        project={project}
        onStartProject={vi.fn()}
        onStopProject={vi.fn()}
        onSelectComponent={onSelectComponent}
      />
    )
    fireEvent.click(screen.getByText('backend'))
    expect(onSelectComponent).toHaveBeenCalledWith('backend')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/dashboard/ProjectDetail.test.tsx`
Expected: FAIL — cannot find `./ProjectDetail`.

- [ ] **Step 3: Write the implementation**

Create `src/renderer/src/components/dashboard/ProjectDetail.tsx`:

```tsx
import type { ProjectStateView } from '../../context/AppContext'
import { StatusBadge } from '../StatusBadge'

interface ProjectDetailProps {
  project: ProjectStateView
  onStartProject: (projectName: string) => void
  onStopProject: (projectName: string) => void
  onSelectComponent: (componentName: string) => void
}

export function ProjectDetail({
  project,
  onStartProject,
  onStopProject,
  onSelectComponent
}: ProjectDetailProps): React.JSX.Element {
  const components = Object.values(project.components)
  const running = components.filter((c) => c.status === 'running').length
  const aggregatePorts = components.flatMap((c) => c.ports)

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-zinc-100">{project.name}</div>
          <div className="text-[11px] font-mono text-zinc-500 mt-0.5">{project.directory}</div>
        </div>
        <span className="text-[12px] font-mono tabular-nums text-zinc-500 ml-3">{running} / {components.length} running</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onStartProject(project.name)}
            className="px-3 py-1.5 text-[12px] text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
          >
            Start all
          </button>
          <button
            onClick={() => onStopProject(project.name)}
            className="px-3 py-1.5 text-[12px] text-red-400/80 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            Stop all
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Components</h3>
          <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]">
            {components.map((comp) => (
              <button
                key={comp.name}
                onClick={() => onSelectComponent(comp.name)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-left hover:bg-white/[0.02] transition-colors"
              >
                <StatusBadge status={comp.status} size="md" />
                <span className="text-zinc-300 font-medium">{comp.name}</span>
                {comp.ports[0] && (
                  <span className="font-mono text-[11px] text-zinc-600">:{comp.ports[0].port}</span>
                )}
                <span className="ml-auto text-[11px] text-zinc-500">View logs →</span>
              </button>
            ))}
          </div>
        </section>

        {aggregatePorts.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Ports</h3>
            <div className="flex flex-wrap gap-2">
              {aggregatePorts.map((port, i) => (
                <span
                  key={`${port.port}-${i}`}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                    port.status === 'conflict' ? 'bg-amber-500/10 text-amber-400' :
                    port.status === 'in-use' ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-zinc-700/50 text-zinc-400'
                  }`}
                >
                  :{port.port} {port.label}
                </span>
              ))}
            </div>
          </section>
        )}

        {project.dependencies.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Dependencies</h3>
            <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]">
              {project.dependencies.map((dep, i) => {
                const name = dep.dependency.name ?? dep.dependency.container ?? 'unknown'
                return (
                  <div key={`${name}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                    <StatusBadge
                      status={dep.health === 'healthy' ? 'healthy' : dep.health === 'unhealthy' ? 'unhealthy' : 'unknown'}
                      size="md"
                    />
                    <span className="text-zinc-300">{name}</span>
                    <span className="ml-auto text-[12px] text-zinc-500">{dep.health}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/dashboard/ProjectDetail.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/dashboard/ProjectDetail.tsx src/renderer/src/components/dashboard/ProjectDetail.test.tsx
git commit -m "feat: add dashboard ProjectDetail rollup"
```

---

## Task 10: SettingsView (reworked Settings)

Reworks `SettingsTab` into `SettingsView`: native folder picker for scan dirs, sectioned layout, real dirty/save state.

**Files:**
- Create: `src/renderer/src/components/dashboard/SettingsView.tsx`
- Test: `src/renderer/src/components/dashboard/SettingsView.test.tsx`
- (Delete `SettingsTab.tsx` in Task 12.)

- [ ] **Step 1: Write the failing test**

Create `src/renderer/src/components/dashboard/SettingsView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsView } from './SettingsView'

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getConfig: vi.fn().mockResolvedValue({
      scanDirectories: ['~/work'],
      scanIntervalMs: 5000,
      portScanIntervalMs: 3000,
      editor: 'code',
      terminal: 'default',
      gitGui: 'fork'
    }),
    saveConfig: vi.fn().mockResolvedValue(true),
    selectDirectory: vi.fn().mockResolvedValue('/Users/me/projects')
  }
})

describe('SettingsView', () => {
  it('disables Save until a change is made', async () => {
    render(<SettingsView />)
    await waitFor(() => expect(screen.getByText('~/work')).toBeInTheDocument())
    const save = screen.getByRole('button', { name: /save/i })
    expect(save).toBeDisabled()
  })

  it('adds a directory via the native folder picker and enables Save', async () => {
    render(<SettingsView />)
    await waitFor(() => expect(screen.getByText('~/work')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /add directory/i }))
    await waitFor(() => expect(screen.getByText('/Users/me/projects')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/dashboard/SettingsView.test.tsx`
Expected: FAIL — cannot find `./SettingsView`.

- [ ] **Step 3: Write the implementation**

Create `src/renderer/src/components/dashboard/SettingsView.tsx`:

```tsx
import { useState, useEffect } from 'react'

interface SettingsForm {
  scanDirectories: string[]
  scanIntervalMs: number
  portScanIntervalMs: number
  editor: string
  terminal: string
  gitGui: string
}

const DEFAULTS: SettingsForm = {
  scanDirectories: [],
  scanIntervalMs: 5000,
  portScanIntervalMs: 3000,
  editor: 'code',
  terminal: 'default',
  gitGui: 'fork'
}

function normalize(config: Partial<SettingsForm>): SettingsForm {
  return {
    scanDirectories: config.scanDirectories ?? [],
    scanIntervalMs: config.scanIntervalMs ?? DEFAULTS.scanIntervalMs,
    portScanIntervalMs: config.portScanIntervalMs ?? DEFAULTS.portScanIntervalMs,
    editor: config.editor ?? DEFAULTS.editor,
    terminal: config.terminal ?? DEFAULTS.terminal,
    gitGui: config.gitGui ?? DEFAULTS.gitGui
  }
}

const SELECT_CLASS =
  'w-full px-3 py-2 bg-zinc-800 border border-white/[0.08] rounded-lg text-[13px] text-zinc-300 focus:outline-none focus:border-zinc-500 transition-colors'

export function SettingsView(): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsForm>(DEFAULTS)
  const [saved, setSaved] = useState<SettingsForm | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    window.api.getConfig().then((config) => {
      const normalized = normalize(config as Partial<SettingsForm>)
      setSettings(normalized)
      setSaved(normalized)
    })
  }, [])

  const dirty = saved !== null && JSON.stringify(settings) !== JSON.stringify(saved)

  const handleSave = async (): Promise<void> => {
    await window.api.saveConfig(settings)
    setSaved(settings)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const addDirectory = async (): Promise<void> => {
    const dir = await window.api.selectDirectory()
    if (dir && !settings.scanDirectories.includes(dir)) {
      setSettings({ ...settings, scanDirectories: [...settings.scanDirectories, dir] })
    }
  }

  const removeDirectory = (dir: string): void => {
    setSettings({ ...settings, scanDirectories: settings.scanDirectories.filter((d) => d !== dir) })
  }

  return (
    <div className="p-6 max-w-2xl space-y-7 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
      <section>
        <h3 className="text-[13px] font-medium text-zinc-200 mb-1">Scan Directories</h3>
        <p className="text-[12px] text-zinc-500 mb-3">
          Directories scanned for projects with a <span className="font-mono text-zinc-400">.service-starter.yml</span> manifest.
        </p>
        <div className="space-y-1.5 mb-3">
          {settings.scanDirectories.map((dir) => (
            <div key={dir} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-white/[0.06]">
              <span className="flex-1 text-[13px] font-mono text-zinc-400 break-all">{dir}</span>
              <button onClick={() => removeDirectory(dir)} className="text-zinc-600 hover:text-red-400 transition-colors" aria-label={`Remove ${dir}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addDirectory}
          className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-[13px] text-zinc-200 rounded-lg transition-colors"
        >
          Add directory…
        </button>
      </section>

      <section>
        <h3 className="text-[13px] font-medium text-zinc-200 mb-3">Scan Intervals</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] text-zinc-500 block mb-1">Project scan (ms)</label>
            <input
              type="number"
              value={settings.scanIntervalMs}
              onChange={(e) => setSettings({ ...settings, scanIntervalMs: parseInt(e.target.value) || DEFAULTS.scanIntervalMs })}
              className={SELECT_CLASS + ' font-mono'}
            />
          </div>
          <div>
            <label className="text-[12px] text-zinc-500 block mb-1">Port scan (ms)</label>
            <input
              type="number"
              value={settings.portScanIntervalMs}
              onChange={(e) => setSettings({ ...settings, portScanIntervalMs: parseInt(e.target.value) || DEFAULTS.portScanIntervalMs })}
              className={SELECT_CLASS + ' font-mono'}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[13px] font-medium text-zinc-200 mb-3">Applications</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-[12px] text-zinc-500 block mb-1">Editor</label>
            <select value={settings.editor} onChange={(e) => setSettings({ ...settings, editor: e.target.value })} className={SELECT_CLASS}>
              <option value="code">VS Code</option>
              <option value="cursor">Cursor</option>
              <option value="zed">Zed</option>
              <option value="idea">IntelliJ IDEA</option>
              <option value="webstorm">WebStorm</option>
              <option value="sublime">Sublime Text</option>
            </select>
          </div>
          <div>
            <label className="text-[12px] text-zinc-500 block mb-1">Terminal</label>
            <select value={settings.terminal} onChange={(e) => setSettings({ ...settings, terminal: e.target.value })} className={SELECT_CLASS}>
              <option value="default">Terminal.app</option>
              <option value="iterm">iTerm2</option>
              <option value="warp">Warp</option>
              <option value="alacritty">Alacritty</option>
              <option value="kitty">Kitty</option>
            </select>
          </div>
          <div>
            <label className="text-[12px] text-zinc-500 block mb-1">Git GUI</label>
            <select value={settings.gitGui} onChange={(e) => setSettings({ ...settings, gitGui: e.target.value })} className={SELECT_CLASS}>
              <option value="fork">Fork</option>
              <option value="gitkraken">GitKraken</option>
              <option value="sourcetree">Sourcetree</option>
              <option value="github-desktop">GitHub Desktop</option>
              <option value="tower">Tower</option>
            </select>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={!dirty}
          className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
            dirty ? 'bg-zinc-100 text-zinc-900 hover:bg-white' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          }`}
        >
          Save Settings
        </button>
        {savedFlash && <span className="text-[12px] text-emerald-400">Saved</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/dashboard/SettingsView.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/dashboard/SettingsView.tsx src/renderer/src/components/dashboard/SettingsView.test.tsx
git commit -m "feat: add reworked SettingsView with folder picker and dirty state"
```

---

## Task 11: DashboardWindow shell (wire everything together)

Reworks `DashboardWindow` into the master/detail shell: top nav (`Projects · Settings`), tree selection state, routed detail panel.

**Files:**
- Modify: `src/renderer/src/components/dashboard/DashboardWindow.tsx`
- Test: `src/renderer/src/components/dashboard/DashboardWindow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/src/components/dashboard/DashboardWindow.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DashboardWindow } from './DashboardWindow'
import { AppProvider } from '../../context/AppContext'

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getState: vi.fn().mockResolvedValue({
      trayIcon: 'green',
      favorites: [],
      conflicts: [],
      projects: {
        shop: {
          name: 'shop',
          directory: '/shop',
          dependencies: [],
          components: {
            backend: { name: 'backend', status: 'running', processOrigin: 'managed', dependencies: [], ports: [{ port: 8090, label: 'api', status: 'in-use' }] }
          }
        }
      }
    }),
    onStateUpdate: vi.fn().mockReturnValue(() => {}),
    getConfig: vi.fn().mockResolvedValue({}),
    saveConfig: vi.fn(),
    selectDirectory: vi.fn(),
    getComponentEnv: vi.fn().mockResolvedValue({}),
    getLog: vi.fn().mockResolvedValue(''),
    startLogTail: vi.fn(),
    stopLogTail: vi.fn(),
    onLogData: vi.fn().mockReturnValue(() => {}),
    startComponent: vi.fn(),
    stopComponent: vi.fn(),
    startProject: vi.fn(),
    stopProject: vi.fn(),
    restartComponent: vi.fn()
  }
})

function renderDashboard(): void {
  render(
    <AppProvider>
      <DashboardWindow />
    </AppProvider>
  )
}

describe('DashboardWindow', () => {
  it('defaults to the Overview detail', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('Port Map')).toBeInTheDocument())
  })

  it('navigates to Settings via the top nav', async () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    await waitFor(() => expect(screen.getByText('Scan Directories')).toBeInTheDocument())
  })

  it('shows component detail when a component is selected in the tree', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('shop')).toBeInTheDocument())
    fireEvent.click(screen.getByText('shop'))
    fireEvent.click(screen.getByText('backend'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Logs' })).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/dashboard/DashboardWindow.test.tsx`
Expected: FAIL — the current `DashboardWindow` renders the old tabs, so these queries fail.

- [ ] **Step 3: Replace DashboardWindow**

Overwrite `src/renderer/src/components/dashboard/DashboardWindow.tsx` with:

```tsx
import { useMemo, useState } from 'react'
import { useAppState } from '../../context/AppContext'
import { buildDashboardTree } from '../../utils/dashboardTree'
import { ProjectTree, Selection } from './ProjectTree'
import { OverviewDetail } from './OverviewDetail'
import { ProjectDetail } from './ProjectDetail'
import { ComponentDetail } from './ComponentDetail'
import { SettingsView } from './SettingsView'

type View = 'projects' | 'settings'

export function DashboardWindow(): React.JSX.Element {
  const ctx = useAppState()
  const { state } = ctx
  const [view, setView] = useState<View>('projects')
  const [selection, setSelection] = useState<Selection>({ kind: 'overview' })

  const tree = useMemo(() => buildDashboardTree(state), [state])

  const selectedProject =
    selection.kind === 'project' || selection.kind === 'component'
      ? state.projects[selection.projectName]
      : undefined
  const selectedComponent =
    selection.kind === 'component' ? selectedProject?.components[selection.componentName] : undefined

  return (
    <div className="h-screen flex flex-col bg-zinc-900 text-zinc-100">
      {/* Title bar / drag region */}
      <div
        className="flex items-center gap-4 pl-20 pr-5 pt-3 pb-2"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <h1 className="text-[13px] font-semibold tracking-tight text-zinc-300">Service Starter</h1>
        <nav className="flex gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {(['projects', 'settings'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-[13px] font-medium rounded-md transition-colors ${
                view === v ? 'bg-white/[0.08] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {v === 'projects' ? 'Projects' : 'Settings'}
            </button>
          ))}
        </nav>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0 border-t border-white/[0.06]">
        {view === 'settings' ? (
          <SettingsView />
        ) : (
          <>
            <ProjectTree tree={tree} selection={selection} onSelect={setSelection} />
            <div className="flex-1 flex flex-col min-h-0">
              {selection.kind === 'component' && selectedComponent ? (
                <ComponentDetail
                  projectName={selection.projectName}
                  component={selectedComponent}
                  onStart={ctx.startComponent}
                  onStop={ctx.stopComponent}
                  onRestart={ctx.restartComponent}
                />
              ) : selection.kind === 'project' && selectedProject ? (
                <ProjectDetail
                  project={selectedProject}
                  onStartProject={ctx.startProject}
                  onStopProject={ctx.stopProject}
                  onSelectComponent={(componentName) =>
                    setSelection({ kind: 'component', projectName: selectedProject.name, componentName })
                  }
                />
              ) : (
                <OverviewDetail state={state} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

Note: `ctx.startComponent`/`stopComponent`/`restartComponent` return Promises; `ComponentDetail`'s handler props are typed `(p, c) => void`. Passing a Promise-returning function where `void` is expected is allowed in TS. If strict lint complains, wrap inline: `onStart={(p, c) => { void ctx.startComponent(p, c) }}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/dashboard/DashboardWindow.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/dashboard/DashboardWindow.tsx src/renderer/src/components/dashboard/DashboardWindow.test.tsx
git commit -m "feat: rework DashboardWindow into master/detail shell"
```

---

## Task 12: Make window resizable + delete absorbed files + full verification

**Files:**
- Modify: `src/main/index.ts`
- Delete: `ProjectsTab.tsx`, `PortMapTab.tsx`, `DependenciesTab.tsx`, `ConflictWarningBanner.tsx`, `LogViewer.tsx`, `SettingsTab.tsx`

- [ ] **Step 1: Make the dashboard window resizable**

In `src/main/index.ts`, in `createDashboardWindow`, update the `new BrowserWindow({ ... })` options to add resize constraints (keep the existing `width`/`height`/`show`/`titleBarStyle`/`trafficLightPosition`/`webPreferences`):

```ts
  dashboardWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 720,
    minHeight: 480,
    resizable: true,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
```

- [ ] **Step 2: Delete the absorbed components**

```bash
git rm src/renderer/src/components/dashboard/ProjectsTab.tsx \
       src/renderer/src/components/dashboard/PortMapTab.tsx \
       src/renderer/src/components/dashboard/DependenciesTab.tsx \
       src/renderer/src/components/dashboard/ConflictWarningBanner.tsx \
       src/renderer/src/components/dashboard/LogViewer.tsx \
       src/renderer/src/components/dashboard/SettingsTab.tsx
```

- [ ] **Step 3: Verify nothing still imports the deleted files**

Run: `grep -rn "ProjectsTab\|PortMapTab\|DependenciesTab\|ConflictWarningBanner\|LogViewer\|SettingsTab" src/`
Expected: no matches (empty output). If anything matches, fix the import before continuing.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Full test suite**

Run: `npm test`
Expected: PASS — all existing tests plus the new dashboard tests green.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: PASS (no errors). Fix any reported issues.

- [ ] **Step 7: Manual smoke test**

Run: `npm run dev`
Then from the tray, open the dashboard and verify:
- Opens on **Overview** with KPIs + (any) conflicts + global port map.
- Selecting a project shows the rollup with Start all / Stop all.
- Selecting a managed running component streams live logs; Ports/Deps/Env tabs populate.
- Selecting an external component shows the "No logs — external process" state.
- **Settings**: "Add directory…" opens the native folder picker; Save is disabled until a change; "Saved" appears after saving.
- Resize the window down to the minimum; master/detail stays usable.
- The tray menu is unchanged.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: make dashboard resizable and remove absorbed tab components"
```

---

## Self-Review Notes

- **Spec coverage:** navigation shell (Task 11), project tree + conflict bubbling (Tasks 2, 4), Overview/conflicts/port map (Task 5), component detail tabs (Tasks 6–8), project rollup (Task 9), Settings rework with native picker + dirty state (Tasks 1, 10), resizable window + visual language + file removal (Task 12), env IPC (Tasks 1, 7). Combined logs and the other "out of scope" items are intentionally absent.
- **Tray untouched:** only `src/main/index.ts` (window options + two deps), `channels.ts`, `handlers.ts`, `preload/*` change in main; no `src/main/tray/*` edits.
- **Type consistency:** `Selection` defined in `ProjectTree.tsx` and reused by `DashboardWindow.tsx`; `TreeProject`/`TreeComponent` from `dashboardTree.ts`; `computeKpis` shape matches `OverviewDetail` usage; IPC method names (`selectDirectory`, `getComponentEnv`) consistent across preload, dts, and call sites.
- **Verified APIs:** `formatUptime(startedAt, now)` signature confirmed; `ResolvedProject.components[name].env` confirmed for the env handler; existing log-tail IPC (`getLog`/`startLogTail`/`onLogData`) reused unchanged.
```
