# Tray Menu Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat tray dropdown with a hybrid command-palette + dashboard-list: KPI strip, persistent search, auto-grouped Conflicts / Active / Idle sections, always-visible + native right-click actions, favorites, and uptime.

**Architecture:** Pure, node-testable utilities (`sortServices`, `searchMatcher`, `formatUptime`) drive a reworked renderer. The main process gains a favorites store (path-injected, mirroring `central-config.ts`), uptime sourced from `ProcessManager.getManagedProcess().startedAt`, native Electron context menus over IPC, and a handful of new service actions. State continues to flow through `buildAppState()` → `pushStateToRenderers()`; `favorites` rides along inside `AppStateView`.

**Tech Stack:** TypeScript, Electron 39, React 19, Tailwind 3, Vitest 4 (node + jsdom projects), `@testing-library/react`.

---

## Deviations from spec (deliberate)

1. **Favorites persistence API.** The spec proposes `loadFavorites(): Promise<string[]>` etc. with the module owning the path and a `Set`. That couples the module to `electron.app` and makes it un-unit-testable in the `node` vitest env. Instead, `favorites.ts` exports **pure, path-injected** functions (`loadFavorites(path)`, `saveFavorites(path, list)`, `toggleFavorite(list, name)`, `isFavorite(list, name)`), exactly like `central-config.ts`. `index.ts` owns the resolved `userData` path and the in-memory list.
2. **No `favorites:changed` channel.** `favorites` becomes a field on `AppStateView`, so the existing `state:update` push already propagates changes. We add only `favorites:get` and `favorites:toggle`.
3. **`StatusBadge` stays in `components/`** (shared with the dashboard). `PortSummary` is tray-only and is **superseded by `FooterActions`** (deleted at the end).
4. **`service:tail-logs`** opens the dashboard window in v1. Deep-linking to a component's Logs tab needs dashboard routing that is out of this spec's scope; noted as a follow-up.

---

## File Structure

**New files:**
- `vitest.setup.ts` — jest-dom matchers + RTL cleanup (jsdom project)
- `src/renderer/src/utils/formatUptime.ts` (+ `.test.ts`) — duration formatter
- `src/renderer/src/utils/searchMatcher.ts` (+ `.test.ts`) — query → row matcher
- `src/renderer/src/utils/sortServices.ts` (+ `.test.ts`) — `AppStateView` → ordered sections
- `src/main/config/favorites.ts` (+ `.test.ts`) — pure favorites persistence
- `src/main/tray/context-menus.ts` — native context-menu builder + IPC registration
- `src/renderer/src/components/tray/KpiStrip.tsx`
- `src/renderer/src/components/tray/SearchBar.tsx` (+ `.test.tsx`)
- `src/renderer/src/components/tray/ConflictRow.tsx`
- `src/renderer/src/components/tray/ConflictsSection.tsx` (+ `.test.tsx`)
- `src/renderer/src/components/tray/ActiveProjectsSection.tsx`
- `src/renderer/src/components/tray/IdleProjectsSection.tsx` (+ `.test.tsx`)
- `src/renderer/src/components/tray/ContextMenuTrigger.tsx` (+ `.test.tsx`)
- `src/renderer/src/components/tray/FooterActions.tsx`

**Moved into `src/renderer/src/components/tray/`:**
- `ComponentRow.tsx` (polished) (+ `.test.tsx`)
- `ProjectGroup.tsx` (polished) (+ `.test.tsx`)
- `TrayDropdown.tsx` (reworked) (+ `.test.tsx`)

**Modified:**
- `vitest.config.ts` — two `projects` (node + jsdom)
- `package.json` — add jsdom + RTL dev deps
- `src/main/config/types.ts` — `startedAt?` on `ComponentState`, `favorites` on `AppState`
- `src/renderer/src/context/AppContext.tsx` — `startedAt?` on `ComponentStateView`, `favorites` on `AppStateView`, new action methods
- `src/main/ipc/channels.ts` — new channels
- `src/main/ipc/handlers.ts` — new handlers + `favorites` in `serializeState`
- `src/main/index.ts` — favorites store, uptime in `buildAppState`, new actions, context-menu registration
- `src/main/tray/quick-actions.ts` — `getProcessInfo`, `openManifest` helpers
- `src/main/tray/tray-window.ts` — window size 360×480 → 420×560
- `src/preload/index.ts` + `index.d.ts` — new API methods
- `src/renderer/src/App.tsx` — import path for relocated `TrayDropdown`

**Deleted:**
- `src/renderer/src/components/PortSummary.tsx` (superseded by `FooterActions`)

---

# Phase 0 — Test infrastructure

### Task 1: Add jsdom + RTL and a two-project Vitest config

**Files:**
- Modify: `package.json` (via npm)
- Create: `vitest.setup.ts`
- Modify: `vitest.config.ts`
- Create (smoke test): `src/renderer/src/utils/smoke.test.tsx`

- [ ] **Step 1: Install dev dependencies**

Run (verify latest compatible versions at install time; these majors support React 19):

```bash
npm install -D jsdom@^26 @testing-library/react@^16 @testing-library/dom@^10 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```

- [ ] **Step 2: Create the jsdom setup file**

```typescript
// vitest.setup.ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 3: Rewrite `vitest.config.ts` with two projects**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/main/**/*.ts']
    },
    projects: [
      {
        extends: true,
        test: {
          name: { label: 'node', color: 'green' },
          environment: 'node',
          include: ['src/**/*.test.ts']
        }
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: { label: 'dom', color: 'magenta' },
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.tsx'],
          setupFiles: ['./vitest.setup.ts']
        }
      }
    ]
  }
})
```

- [ ] **Step 4: Add a temporary smoke test to prove jsdom + RTL work**

```tsx
// src/renderer/src/utils/smoke.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('jsdom + RTL smoke', () => {
  it('renders into the DOM', () => {
    render(<button>hello</button>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run the full suite — node tests still pass, dom test passes**

Run: `npm test`
Expected: PASS for both projects (`node` and `dom`). The existing `src/**/*.test.ts` suites run under `node`; the smoke test runs under `dom`.

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm src/renderer/src/utils/smoke.test.tsx
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "test: add jsdom + RTL vitest project for renderer component tests"
```

---

# Phase 1 — Pure utilities & data-layer types

### Task 2: Add `startedAt` and `favorites` to the data-layer types

**Files:**
- Modify: `src/main/config/types.ts`
- Modify: `src/renderer/src/context/AppContext.tsx`

- [ ] **Step 1: Extend the main-process types**

In `src/main/config/types.ts`, add `startedAt?` to `ComponentState`:

```typescript
export interface ComponentState {
  name: string
  status: ComponentStatus
  processOrigin: ProcessOrigin
  ports: PortState[]
  dependencies: DependencyState[]
  editor?: string
  codeDir?: string
  workDir?: string
  startedAt?: number // epoch ms; only set for managed processes
}
```

And add `favorites` to `AppState`:

```typescript
export interface AppState {
  projects: Record<string, ProjectState>
  trayIcon: TrayIconState
  conflicts: PortConflict[]
  favorites: string[]
}
```

- [ ] **Step 2: Extend the renderer view types**

In `src/renderer/src/context/AppContext.tsx`, add `startedAt?` to `ComponentStateView`:

```typescript
export interface ComponentStateView {
  name: string
  status: 'running' | 'stopped' | 'warning'
  processOrigin: 'managed' | 'external' | 'none'
  ports: PortStateView[]
  dependencies: DependencyStateView[]
  editor?: string
  codeDir?: string
  workDir?: string
  startedAt?: number
}
```

Add `favorites` to `AppStateView` and `DEFAULT_STATE`:

```typescript
export interface AppStateView {
  projects: Record<string, ProjectStateView>
  trayIcon: 'grey' | 'green' | 'orange'
  conflicts: PortConflictView[]
  favorites: string[]
}

const DEFAULT_STATE: AppStateView = {
  projects: {},
  trayIcon: 'grey',
  conflicts: [],
  favorites: []
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (`buildAppState` will be wired to populate the new fields in Task 7; until then `AppState.favorites` is required — temporarily satisfy it in Step 4.)

- [ ] **Step 4: Keep the build green by stubbing the new `AppState` field**

In `src/main/index.ts`, in the `buildAppState()` return object, add `favorites: []` (replaced with the real store in Task 7) and add `favorites` to `serializeState` in `src/main/ipc/handlers.ts`:

```typescript
// src/main/ipc/handlers.ts — serializeState
function serializeState(state: AppState): Record<string, unknown> {
  return {
    projects: state.projects,
    trayIcon: state.trayIcon,
    conflicts: state.conflicts,
    favorites: state.favorites
  }
}
```

```typescript
// src/main/index.ts — buildAppState return
  return {
    projects,
    trayIcon,
    conflicts: monitorState.conflicts,
    favorites: []
  }
```

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: PASS

```bash
git add src/main/config/types.ts src/renderer/src/context/AppContext.tsx src/main/index.ts src/main/ipc/handlers.ts
git commit -m "feat: add startedAt and favorites to app state types"
```

---

### Task 3: `formatUptime`

**Files:**
- Create: `src/renderer/src/utils/formatUptime.ts`
- Test: `src/renderer/src/utils/formatUptime.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/src/utils/formatUptime.test.ts
import { describe, it, expect } from 'vitest'
import { formatUptime } from './formatUptime'

const NOW = 1_000_000_000_000

describe('formatUptime', () => {
  it('returns an em dash for undefined start time', () => {
    expect(formatUptime(undefined, NOW)).toBe('—')
  })

  it('clamps future/negative durations to 0s', () => {
    expect(formatUptime(NOW + 5000, NOW)).toBe('0s')
  })

  it('formats seconds below a minute', () => {
    expect(formatUptime(NOW - 0, NOW)).toBe('0s')
    expect(formatUptime(NOW - 59_000, NOW)).toBe('59s')
  })

  it('formats whole minutes', () => {
    expect(formatUptime(NOW - 60_000, NOW)).toBe('1m')
    expect(formatUptime(NOW - 59 * 60_000, NOW)).toBe('59m')
  })

  it('formats hours, omitting zero minutes', () => {
    expect(formatUptime(NOW - 60 * 60_000, NOW)).toBe('1h')
    expect(formatUptime(NOW - 90 * 60_000, NOW)).toBe('1h 30m')
  })

  it('formats days, omitting zero hours', () => {
    expect(formatUptime(NOW - 24 * 3_600_000, NOW)).toBe('1d')
    expect(formatUptime(NOW - 28 * 3_600_000, NOW)).toBe('1d 4h')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- formatUptime`
Expected: FAIL — `formatUptime` is not defined.

- [ ] **Step 3: Implement**

```typescript
// src/renderer/src/utils/formatUptime.ts

/**
 * Formats elapsed time since `startedAt` as a compact human string.
 * Returns '—' when the start time is unknown (e.g. external processes).
 */
export function formatUptime(startedAt: number | undefined, now: number = Date.now()): string {
  if (startedAt === undefined || !Number.isFinite(startedAt)) return '—'

  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`

  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes}m`

  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) {
    const minutes = totalMinutes % 60
    return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`
  }

  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- formatUptime`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/utils/formatUptime.ts src/renderer/src/utils/formatUptime.test.ts
git commit -m "feat: add formatUptime utility"
```

---

### Task 4: `searchMatcher`

**Files:**
- Create: `src/renderer/src/utils/searchMatcher.ts`
- Test: `src/renderer/src/utils/searchMatcher.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/src/utils/searchMatcher.test.ts
import { describe, it, expect } from 'vitest'
import { searchMatcher, SearchableRow } from './searchMatcher'

const row = (over: Partial<SearchableRow> = {}): SearchableRow => ({
  projectName: 'bandai',
  componentName: 'frontend',
  ports: [3000],
  ...over
})

describe('searchMatcher', () => {
  it('matches everything on an empty query', () => {
    expect(searchMatcher('', row())).toBe(true)
    expect(searchMatcher('   ', row())).toBe(true)
  })

  it('matches a substring of project/component, case-insensitive', () => {
    expect(searchMatcher('FRONT', row())).toBe(true)
    expect(searchMatcher('bandai/front', row())).toBe(true)
    expect(searchMatcher('backend', row())).toBe(false)
  })

  it('matches a port prefix, with or without a leading colon', () => {
    expect(searchMatcher('30', row())).toBe(true)
    expect(searchMatcher(':30', row())).toBe(true)
    expect(searchMatcher(':81', row())).toBe(false)
  })

  it('requires every whitespace-separated token to match (AND)', () => {
    expect(searchMatcher('band 3000', row())).toBe(true)
    expect(searchMatcher('band 9999', row())).toBe(false)
  })

  it('matches project-header rows that have no component name', () => {
    const header = row({ componentName: undefined, ports: [3000, 8090] })
    expect(searchMatcher('bandai', header)).toBe(true)
    expect(searchMatcher('80', header)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- searchMatcher`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/renderer/src/utils/searchMatcher.ts

export interface SearchableRow {
  projectName: string
  componentName?: string
  ports: number[]
}

/**
 * Returns true when every whitespace-separated token in `query` matches the row.
 * A token matches if it is a substring of `project/component` (or just `project`
 * for header rows) OR a prefix of one of the row's port numbers. A leading ':'
 * on a token is stripped so ":30" matches port 3000. Empty query matches all.
 */
export function searchMatcher(query: string, row: SearchableRow): boolean {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  const haystack = (
    row.componentName ? `${row.projectName}/${row.componentName}` : row.projectName
  ).toLowerCase()
  const portStrings = row.ports.map((p) => String(p))

  return tokens.every((token) => {
    if (haystack.includes(token)) return true
    const portToken = token.startsWith(':') ? token.slice(1) : token
    if (portToken.length > 0 && /^\d+$/.test(portToken)) {
      return portStrings.some((p) => p.startsWith(portToken))
    }
    return false
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- searchMatcher`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/utils/searchMatcher.ts src/renderer/src/utils/searchMatcher.test.ts
git commit -m "feat: add searchMatcher utility"
```

---

### Task 5: `sortServices`

**Files:**
- Create: `src/renderer/src/utils/sortServices.ts`
- Test: `src/renderer/src/utils/sortServices.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/src/utils/sortServices.test.ts
import { describe, it, expect } from 'vitest'
import { sortServices } from './sortServices'
import {
  AppStateView,
  ComponentStateView,
  ProjectStateView,
  PortStateView
} from '../context/AppContext'

function port(over: Partial<PortStateView> = {}): PortStateView {
  return { port: 3000, label: 'web', status: 'free', ...over }
}

function comp(name: string, over: Partial<ComponentStateView> = {}): ComponentStateView {
  return {
    name,
    status: 'stopped',
    processOrigin: 'none',
    ports: [port()],
    dependencies: [],
    ...over
  }
}

function project(name: string, components: ComponentStateView[]): ProjectStateView {
  return {
    name,
    directory: `/work/${name}`,
    components: Object.fromEntries(components.map((c) => [c.name, c])),
    dependencies: []
  }
}

function appState(projects: ProjectStateView[], conflicts: AppStateView['conflicts'] = []): AppStateView {
  return {
    projects: Object.fromEntries(projects.map((p) => [p.name, p])),
    trayIcon: 'grey',
    conflicts,
    favorites: []
  }
}

describe('sortServices', () => {
  it('places projects with a running component in active, fully-idle in idle', () => {
    const active = project('aaa', [comp('api', { status: 'running' })])
    const idle = project('bbb', [comp('web')])
    const result = sortServices(appState([idle, active]), [])

    expect(result.active.map((p) => p.project.name)).toEqual(['aaa'])
    expect(result.idle.map((p) => p.project.name)).toEqual(['bbb'])
  })

  it('keeps idle siblings inside a partially-running project, running first', () => {
    const p = project('bandai', [
      comp('docs'),
      comp('frontend', { status: 'running' }),
      comp('mobile')
    ])
    const result = sortServices(appState([p]), [])

    expect(result.active).toHaveLength(1)
    const group = result.active[0]
    expect(group.runningCount).toBe(1)
    expect(group.totalCount).toBe(3)
    expect(group.components.map((c) => c.component.name)).toEqual(['frontend', 'docs', 'mobile'])
  })

  it('treats a project with a conflicting (not running) component as active', () => {
    const p = project('zeta', [comp('api', { ports: [port({ status: 'conflict' })] })])
    const result = sortServices(appState([p]), [])
    expect(result.active.map((p) => p.project.name)).toEqual(['zeta'])
    expect(result.idle).toHaveLength(0)
  })

  it('sorts favorites to the top of idle, then alphabetical', () => {
    const a = project('alpha', [comp('x')])
    const z = project('zed', [comp('x')])
    const m = project('mid', [comp('x')])
    const result = sortServices(appState([a, z, m]), ['zed'])
    expect(result.idle.map((p) => p.project.name)).toEqual(['zed', 'alpha', 'mid'])
    expect(result.idle[0].isFavorite).toBe(true)
  })

  it('flattens conflicts from state.conflicts, sorted by primary claimant then port', () => {
    const state = appState(
      [project('p', [comp('x')])],
      [
        { port: 8090, type: 'static', claimants: ['bandai/backend'], activePid: 5 },
        { port: 3001, type: 'static', claimants: ['bandai/docs'], activePid: 6 }
      ]
    )
    const result = sortServices(state, [])
    expect(result.conflicts.map((c) => c.primaryLabel)).toEqual(['bandai/backend', 'bandai/docs'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- sortServices`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/renderer/src/utils/sortServices.ts
import { AppStateView, ComponentStateView, ProjectStateView } from '../context/AppContext'

export interface ConflictRow {
  port: number
  claimants: string[]
  primaryLabel: string
  activeProcess?: string
  activePid?: number
}

export interface ComponentRowData {
  projectName: string
  component: ComponentStateView
  isRunning: boolean
  isConflicting: boolean
}

export interface ProjectRow {
  project: ProjectStateView
  isFavorite: boolean
  runningCount: number
  totalCount: number
  components: ComponentRowData[]
}

export interface SortedSections {
  conflicts: ConflictRow[]
  active: ProjectRow[]
  idle: ProjectRow[]
}

function isComponentConflicting(c: ComponentStateView): boolean {
  return c.ports.some((p) => p.status === 'conflict')
}

/**
 * Produces the three ordered sections for the tray. A project appears in exactly
 * one of active/idle: active if ANY component is running or conflicting.
 * Within a project group, running/conflicting components sort before idle ones.
 */
export function sortServices(state: AppStateView, favorites: string[]): SortedSections {
  const favoriteSet = new Set(favorites)

  const conflicts: ConflictRow[] = state.conflicts
    .map((c) => ({
      port: c.port,
      claimants: c.claimants,
      primaryLabel: c.claimants[0] ?? `:${c.port}`,
      activeProcess: c.activeProcess,
      activePid: c.activePid
    }))
    .sort((a, b) => a.primaryLabel.localeCompare(b.primaryLabel) || a.port - b.port)

  const active: ProjectRow[] = []
  const idle: ProjectRow[] = []

  const projects = Object.values(state.projects).sort((a, b) => a.name.localeCompare(b.name))

  for (const project of projects) {
    const rows: ComponentRowData[] = Object.values(project.components).map((component) => ({
      projectName: project.name,
      component,
      isRunning: component.status === 'running',
      isConflicting: isComponentConflicting(component)
    }))

    const sortedRows = [...rows].sort((a, b) => {
      const aActive = a.isRunning || a.isConflicting
      const bActive = b.isRunning || b.isConflicting
      if (aActive !== bActive) return aActive ? -1 : 1
      return a.component.name.localeCompare(b.component.name)
    })

    const projectRow: ProjectRow = {
      project,
      isFavorite: favoriteSet.has(project.name),
      runningCount: rows.filter((r) => r.isRunning).length,
      totalCount: rows.length,
      components: sortedRows
    }

    if (rows.some((r) => r.isRunning || r.isConflicting)) active.push(projectRow)
    else idle.push(projectRow)
  }

  // active is already alphabetical (projects pre-sorted); idle: favorites first.
  idle.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    return a.project.name.localeCompare(b.project.name)
  })

  return { conflicts, active, idle }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- sortServices`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/utils/sortServices.ts src/renderer/src/utils/sortServices.test.ts
git commit -m "feat: add sortServices utility"
```

---

# Phase 2 — Main process

### Task 6: Favorites persistence module

**Files:**
- Create: `src/main/config/favorites.ts`
- Test: `src/main/config/favorites.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/main/config/favorites.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadFavorites, saveFavorites, toggleFavorite, isFavorite } from './favorites'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('favorites', () => {
  let dir: string
  let path: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fav-test-'))
    path = join(dir, 'favorites.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns an empty list when the file does not exist', () => {
    expect(loadFavorites(path)).toEqual([])
  })

  it('round-trips through save/load', () => {
    saveFavorites(path, ['bandai', 'mflow'])
    expect(loadFavorites(path)).toEqual(['bandai', 'mflow'])
  })

  it('returns an empty list for a corrupt file', () => {
    writeFileSync(path, '{ not json', 'utf-8')
    expect(loadFavorites(path)).toEqual([])
  })

  it('toggle adds when absent and removes when present (pure)', () => {
    expect(toggleFavorite([], 'a')).toEqual(['a'])
    expect(toggleFavorite(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('isFavorite reflects membership', () => {
    expect(isFavorite(['a'], 'a')).toBe(true)
    expect(isFavorite(['a'], 'b')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- favorites`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/main/config/favorites.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

/** Reads the favorites list from disk; returns [] when missing or corrupt. */
export function loadFavorites(favoritesPath: string): string[] {
  if (!existsSync(favoritesPath)) return []
  try {
    const parsed = JSON.parse(readFileSync(favoritesPath, 'utf-8'))
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/** Writes the favorites list, creating the parent directory if needed. */
export function saveFavorites(favoritesPath: string, favorites: string[]): void {
  const dir = dirname(favoritesPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(favoritesPath, JSON.stringify(favorites, null, 2), 'utf-8')
}

/** Returns a new list with `projectName` toggled. Pure. */
export function toggleFavorite(favorites: string[], projectName: string): string[] {
  return favorites.includes(projectName)
    ? favorites.filter((n) => n !== projectName)
    : [...favorites, projectName]
}

export function isFavorite(favorites: string[], projectName: string): boolean {
  return favorites.includes(projectName)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- favorites`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/config/favorites.ts src/main/config/favorites.test.ts
git commit -m "feat: add favorites persistence module"
```

---

### Task 7: Wire favorites + uptime into main, with IPC

**Files:**
- Modify: `src/main/ipc/channels.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

- [ ] **Step 1: Add favorites channels**

In `src/main/config`... no — in `src/main/ipc/channels.ts`, add to the `IPC_CHANNELS` object:

```typescript
  // Favorites
  FAVORITES_GET: 'favorites:get',
  FAVORITES_TOGGLE: 'favorites:toggle',
```

- [ ] **Step 2: Add favorites to handler dependencies and register handlers**

In `src/main/ipc/handlers.ts`, extend `HandlerDependencies`:

```typescript
  getFavorites: () => string[]
  toggleFavorite: (projectName: string) => string[]
```

Register inside `registerIpcHandlers` (after the SAVE_CONFIG handler):

```typescript
  ipcMain.handle(IPC_CHANNELS.FAVORITES_GET, () => {
    return deps.getFavorites()
  })

  ipcMain.handle(IPC_CHANNELS.FAVORITES_TOGGLE, (_event, projectName: string) => {
    return deps.toggleFavorite(projectName)
  })
```

(`serializeState` already includes `favorites` from Task 2 Step 4.)

- [ ] **Step 3: Add the favorites store + uptime in `index.ts`**

In `src/main/index.ts`, add imports:

```typescript
import { app, BrowserWindow, clipboard, dialog } from 'electron'
import { loadFavorites, saveFavorites, toggleFavorite as toggleFav, isFavorite } from './config/favorites'
```

Add a module-level store:

```typescript
let favorites: string[] = []
const favoritesPath = (): string => join(app.getPath('userData'), 'favorites.json')
```

In `app.whenReady()`, after `centralConfig = loadCentralConfig()`:

```typescript
  favorites = loadFavorites(favoritesPath())
```

In `buildAppState()`, set `startedAt` when building each component (inside the `for (const [compName, comp] ...)` loop, replace the `components[compName] = {...}` assignment):

```typescript
      const managed = processManager.getManagedProcess(project.name, compName)
      const startedAt = managed ? Date.parse(managed.startedAt) : undefined

      components[compName] = {
        name: compName,
        status: runtimeState.status,
        processOrigin: runtimeState.processOrigin,
        ports: portStates,
        dependencies: depStates,
        editor: comp.editor,
        codeDir: comp.codeDir ? join(dir, comp.codeDir) : undefined,
        workDir: comp.workDir ? join(dir, comp.workDir) : undefined,
        startedAt: Number.isNaN(startedAt) ? undefined : startedAt
      }
```

Replace the stubbed `favorites: []` in the `buildAppState` return with the store:

```typescript
  return {
    projects,
    trayIcon,
    conflicts: monitorState.conflicts,
    favorites
  }
```

In `registerIpcHandlers({ ... })`, add the two deps:

```typescript
    getFavorites: () => favorites,
    toggleFavorite: (projectName: string) => {
      favorites = toggleFav(favorites, projectName)
      saveFavorites(favoritesPath(), favorites)
      pushState()
      return favorites
    },
```

- [ ] **Step 4: Expose favorites in preload**

In `src/preload/index.ts`, add to the `api` object:

```typescript
  // Favorites
  getFavorites: () => ipcRenderer.invoke('favorites:get'),
  toggleFavorite: (projectName: string) => ipcRenderer.invoke('favorites:toggle', projectName),
```

In `src/preload/index.d.ts`, add to `ServiceStarterAPI`:

```typescript
  getFavorites: () => Promise<string[]>
  toggleFavorite: (projectName: string) => Promise<string[]>
```

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: PASS

```bash
git add src/main/ipc/channels.ts src/main/ipc/handlers.ts src/main/index.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: wire favorites store and component uptime into app state"
```

---

### Task 8: New service actions (restart, copy, edit-manifest, process-info, stop-all, tail-logs)

**Files:**
- Modify: `src/main/tray/quick-actions.ts`
- Modify: `src/main/ipc/channels.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

- [ ] **Step 1: Add `getProcessInfo` and `openManifest` helpers**

In `src/main/tray/quick-actions.ts`, append:

```typescript
import { join } from 'path'

/**
 * Returns a one-line human description of a PID via `ps`, or null if not found.
 * Format: "node — started Mon May 19 09:14:00 2026".
 */
export async function getProcessInfo(pid: number): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('ps', ['-p', String(pid), '-o', 'comm=,lstart='], (error, stdout) => {
      const line = stdout?.trim()
      if (error || !line) {
        resolve(null)
        return
      }
      resolve(line.replace(/\s{2,}/, ' — started '))
    })
  })
}

/** Opens a project's `.service-starter.yml` in the configured editor. */
export function openManifest(
  projectDir: string,
  editorKey: string = 'code',
  userEditors?: Record<string, EditorConfig>
): void {
  openInEditor(join(projectDir, '.service-starter.yml'), editorKey, userEditors)
}
```

- [ ] **Step 2: Add channels**

In `src/main/ipc/channels.ts`, add:

```typescript
  // Service actions (context menu + buttons)
  RESTART_COMPONENT: 'process:restart-component',
  STOP_ALL_MANAGED: 'process:stop-all-managed',
  COPY_TO_CLIPBOARD: 'action:copy',
  EDIT_MANIFEST: 'action:edit-manifest',
  SHOW_PROCESS_INFO: 'action:show-process-info',
  TAIL_LOGS: 'log:tail-open',
```

- [ ] **Step 3: Add handler dependencies and registrations**

In `src/main/ipc/handlers.ts`, extend `HandlerDependencies`:

```typescript
  restartComponent: (projectName: string, componentName: string) => Promise<void>
  stopAllManaged: () => Promise<void>
  copyToClipboard: (text: string) => void
  editManifest: (projectDir: string) => void
  showProcessInfo: (pid: number) => void
  tailLogs: (projectName: string, componentName: string) => void
```

Register (after the process handlers):

```typescript
  ipcMain.handle(IPC_CHANNELS.RESTART_COMPONENT, async (_event, projectName: string, componentName: string) => {
    await deps.restartComponent(projectName, componentName)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.STOP_ALL_MANAGED, async () => {
    await deps.stopAllManaged()
    return true
  })

  ipcMain.on(IPC_CHANNELS.COPY_TO_CLIPBOARD, (_event, text: string) => {
    deps.copyToClipboard(text)
  })

  ipcMain.on(IPC_CHANNELS.EDIT_MANIFEST, (_event, projectDir: string) => {
    deps.editManifest(projectDir)
  })

  ipcMain.on(IPC_CHANNELS.SHOW_PROCESS_INFO, (_event, pid: number) => {
    deps.showProcessInfo(pid)
  })

  ipcMain.on(IPC_CHANNELS.TAIL_LOGS, (_event, projectName: string, componentName: string) => {
    deps.tailLogs(projectName, componentName)
  })
```

- [ ] **Step 4: Implement the actions in `index.ts`**

In `src/main/index.ts`, add the import:

```typescript
import { openInTerminal, openInEditor, openInGitGui, killProcessOnPort, getProcessInfo, openManifest } from './tray/quick-actions'
```

Factor a reusable component starter (place above `registerIpcHandlers`, replacing the inline `startComponent` body so both start and restart share it):

```typescript
async function startComponentByName(
  projectName: string,
  componentName: string
): Promise<{ pid: number; logFile: string }> {
  for (const [dir, project] of projectRegistry.getProjects()) {
    if (project.name === projectName) {
      const comp = project.components[componentName]
      if (comp && comp.startCommand) {
        return processManager.startComponent({
          projectName,
          componentName,
          startCommand: comp.startCommand,
          workDir: comp.workDir ? join(dir, comp.workDir) : dir,
          projectDir: dir,
          declaredPorts: comp.ports.map((port) => port.port),
          env: comp.env
        })
      }
    }
  }
  throw new Error(`Component ${projectName}/${componentName} not found or has no startCommand`)
}
```

Update the `startComponent` dep to call the helper:

```typescript
    startComponent: (projectName: string, componentName: string) =>
      startComponentByName(projectName, componentName),
```

Add the new deps to the `registerIpcHandlers({ ... })` call:

```typescript
    restartComponent: async (projectName: string, componentName: string) => {
      await processManager.stopComponent(projectName, componentName)
      await startComponentByName(projectName, componentName)
    },
    stopAllManaged: async () => {
      const choice = dialog.showMessageBoxSync({
        type: 'warning',
        buttons: ['Stop all', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        message: 'Stop all managed services?',
        detail: 'This stops every service that Service Starter started.'
      })
      if (choice !== 0) return
      const managed = processManager.getManagedProcesses()
      await Promise.all(
        [...managed.values()].map((p) => processManager.stopComponent(p.projectName, p.componentName))
      )
    },
    copyToClipboard: (text: string) => clipboard.writeText(text),
    editManifest: (projectDir: string) =>
      openManifest(projectDir, centralConfig.editor, centralConfig.editors),
    showProcessInfo: async (pid: number) => {
      const info = await getProcessInfo(pid)
      dialog.showMessageBox({
        type: 'info',
        message: `Process ${pid}`,
        detail: info ?? 'Process not found (it may have exited).'
      })
    },
    tailLogs: (_projectName: string, _componentName: string) => {
      // v1: open the dashboard. Deep-linking to the component's Logs tab is a follow-up.
      createDashboardWindow()
    },
```

- [ ] **Step 5: Expose in preload**

In `src/preload/index.ts`, add to `api`:

```typescript
  restartComponent: (projectName: string, componentName: string) =>
    ipcRenderer.invoke('process:restart-component', projectName, componentName),
  stopAllManaged: () => ipcRenderer.invoke('process:stop-all-managed'),
  copyToClipboard: (text: string) => ipcRenderer.send('action:copy', text),
  editManifest: (projectDir: string) => ipcRenderer.send('action:edit-manifest', projectDir),
  showProcessInfo: (pid: number) => ipcRenderer.send('action:show-process-info', pid),
  tailLogs: (projectName: string, componentName: string) =>
    ipcRenderer.send('log:tail-open', projectName, componentName),
```

In `src/preload/index.d.ts`, add to `ServiceStarterAPI`:

```typescript
  restartComponent: (projectName: string, componentName: string) => Promise<boolean>
  stopAllManaged: () => Promise<boolean>
  copyToClipboard: (text: string) => void
  editManifest: (projectDir: string) => void
  showProcessInfo: (pid: number) => void
  tailLogs: (projectName: string, componentName: string) => void
```

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`
Expected: PASS

```bash
git add src/main/tray/quick-actions.ts src/main/ipc/channels.ts src/main/ipc/handlers.ts src/main/index.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: add restart, copy, edit-manifest, process-info and stop-all actions"
```

---

### Task 9: Native context menus

**Files:**
- Create: `src/main/tray/context-menus.ts`
- Modify: `src/main/ipc/channels.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

- [ ] **Step 1: Add the channel**

In `src/main/ipc/channels.ts`, add:

```typescript
  SHOW_CONTEXT_MENU: 'menu:show',
```

- [ ] **Step 2: Create the context-menu builder**

```typescript
// src/main/tray/context-menus.ts
import { ipcMain, Menu, MenuItemConstructorOptions } from 'electron'
import { IPC_CHANNELS } from '../ipc/channels'

export type ContextMenuType =
  | 'running-service'
  | 'idle-service'
  | 'conflict-service'
  | 'active-project'
  | 'idle-project'
  | 'footer'

export interface ContextMenuPayload {
  projectName: string
  projectDir?: string
  componentName?: string
  port?: number
  pid?: number
}

export interface ContextMenuDeps {
  startComponent: (projectName: string, componentName: string) => void
  stopComponent: (projectName: string, componentName: string) => void
  restartComponent: (projectName: string, componentName: string) => void
  startProject: (projectName: string) => void
  stopProjectManaged: (projectName: string) => void
  killPort: (port: number) => void
  openTerminal: (dir: string) => void
  openEditor: (dir: string) => void
  openGitGui: (dir: string) => void
  copyToClipboard: (text: string) => void
  editManifest: (projectDir: string) => void
  showProcessInfo: (pid: number) => void
  tailLogs: (projectName: string, componentName: string) => void
  toggleFavorite: (projectName: string) => void
  isFavorite: (projectName: string) => boolean
  openDashboard: () => void
  openSettings: () => void
  stopAllManaged: () => void
}

const SEP: MenuItemConstructorOptions = { type: 'separator' }

function buildTemplate(
  type: ContextMenuType,
  p: ContextMenuPayload,
  d: ContextMenuDeps
): MenuItemConstructorOptions[] {
  const dir = p.projectDir ?? ''
  const comp = p.componentName ?? ''
  const url = p.port ? `http://localhost:${p.port}` : ''
  const pinLabel = d.isFavorite(p.projectName) ? 'Unpin Project' : 'Pin Project'

  switch (type) {
    case 'running-service':
      return [
        { label: 'Stop', click: () => d.stopComponent(p.projectName, comp) },
        { label: 'Restart', click: () => d.restartComponent(p.projectName, comp) },
        SEP,
        { label: 'Open Terminal', click: () => d.openTerminal(dir) },
        { label: 'Open Editor', click: () => d.openEditor(dir) },
        { label: 'Open Git GUI', click: () => d.openGitGui(dir) },
        SEP,
        { label: 'Copy URL', enabled: !!url, click: () => d.copyToClipboard(url) },
        { label: 'Copy Port', enabled: !!p.port, click: () => d.copyToClipboard(String(p.port)) },
        { label: 'Tail Logs', click: () => d.tailLogs(p.projectName, comp) },
        SEP,
        { label: pinLabel, click: () => d.toggleFavorite(p.projectName) },
        { label: 'Settings…', click: () => d.openSettings() }
      ]
    case 'idle-service':
      return [
        { label: 'Start', click: () => d.startComponent(p.projectName, comp) },
        SEP,
        { label: 'Open Terminal', click: () => d.openTerminal(dir) },
        { label: 'Open Editor', click: () => d.openEditor(dir) },
        { label: 'Open Git GUI', click: () => d.openGitGui(dir) },
        SEP,
        { label: 'Copy Port', enabled: !!p.port, click: () => d.copyToClipboard(String(p.port)) },
        SEP,
        { label: pinLabel, click: () => d.toggleFavorite(p.projectName) },
        { label: 'Edit Manifest', enabled: !!dir, click: () => d.editManifest(dir) },
        { label: 'Settings…', click: () => d.openSettings() }
      ]
    case 'conflict-service':
      return [
        { label: 'Kill Port', enabled: !!p.port, click: () => p.port && d.killPort(p.port) },
        { label: 'Show Process Info', enabled: !!p.pid, click: () => p.pid && d.showProcessInfo(p.pid) },
        SEP,
        { label: 'Open Terminal', click: () => d.openTerminal(dir) },
        { label: 'Open Editor', click: () => d.openEditor(dir) },
        SEP,
        { label: 'Copy PID', enabled: !!p.pid, click: () => d.copyToClipboard(String(p.pid)) },
        { label: 'Copy Port', enabled: !!p.port, click: () => d.copyToClipboard(String(p.port)) }
      ]
    case 'active-project':
      return [
        { label: 'Start missing services', click: () => d.startProject(p.projectName) },
        { label: 'Stop managed services', click: () => d.stopProjectManaged(p.projectName) },
        SEP,
        { label: 'Open Terminal', click: () => d.openTerminal(dir) },
        { label: 'Open Editor', click: () => d.openEditor(dir) },
        { label: 'Open Git GUI', click: () => d.openGitGui(dir) },
        SEP,
        { label: pinLabel, click: () => d.toggleFavorite(p.projectName) },
        { label: 'Edit Manifest', enabled: !!dir, click: () => d.editManifest(dir) }
      ]
    case 'idle-project':
      return [
        { label: 'Start all', click: () => d.startProject(p.projectName) },
        SEP,
        { label: 'Open Terminal', click: () => d.openTerminal(dir) },
        { label: 'Open Editor', click: () => d.openEditor(dir) },
        { label: 'Open Git GUI', click: () => d.openGitGui(dir) },
        SEP,
        { label: pinLabel, click: () => d.toggleFavorite(p.projectName) },
        { label: 'Edit Manifest', enabled: !!dir, click: () => d.editManifest(dir) }
      ]
    case 'footer':
      return [
        { label: 'Stop all managed services…', click: () => d.stopAllManaged() },
        { label: 'Settings…', click: () => d.openSettings() },
        { label: 'Open Dashboard', click: () => d.openDashboard() }
      ]
  }
}

/** Registers the IPC listener that pops up a native menu for a row. */
export function registerContextMenuIpc(deps: ContextMenuDeps): void {
  ipcMain.on(
    IPC_CHANNELS.SHOW_CONTEXT_MENU,
    (_event, type: ContextMenuType, payload: ContextMenuPayload) => {
      Menu.buildFromTemplate(buildTemplate(type, payload, deps)).popup()
    }
  )
}
```

- [ ] **Step 3: Register in `index.ts`**

In `src/main/index.ts`, add the import and a `stopProjectManaged` helper, then register after `registerIpcHandlers(...)`:

```typescript
import { registerContextMenuIpc } from './tray/context-menus'
```

```typescript
  registerContextMenuIpc({
    startComponent: (p, c) => { void startComponentByName(p, c) },
    stopComponent: (p, c) => { void processManager.stopComponent(p, c) },
    restartComponent: async (p, c) => {
      await processManager.stopComponent(p, c)
      await startComponentByName(p, c)
    },
    startProject: (p) => {
      const managed = processManager.getManagedProcesses()
      for (const [dir, project] of projectRegistry.getProjects()) {
        if (project.name !== p) continue
        for (const [compName, comp] of Object.entries(project.components)) {
          const alreadyRunning = [...managed.values()].some(
            (m) => m.projectName === p && m.componentName === compName
          )
          if (comp.startCommand && !alreadyRunning) void startComponentByName(p, compName)
        }
      }
    },
    stopProjectManaged: (p) => { void processManager.stopProject(p) },
    killPort: (port) => { void killProcessOnPort(port) },
    openTerminal: (dir) => openInTerminal(dir, centralConfig.terminal),
    openEditor: (dir) => openInEditor(dir, centralConfig.editor, centralConfig.editors),
    openGitGui: (dir) => openInGitGui(dir, centralConfig.gitGui),
    copyToClipboard: (text) => clipboard.writeText(text),
    editManifest: (dir) => openManifest(dir, centralConfig.editor, centralConfig.editors),
    showProcessInfo: async (pid) => {
      const info = await getProcessInfo(pid)
      dialog.showMessageBox({
        type: 'info',
        message: `Process ${pid}`,
        detail: info ?? 'Process not found (it may have exited).'
      })
    },
    tailLogs: () => createDashboardWindow(),
    toggleFavorite: (p) => {
      favorites = toggleFav(favorites, p)
      saveFavorites(favoritesPath(), favorites)
      pushState()
    },
    isFavorite: (p) => isFavorite(favorites, p),
    openDashboard: createDashboardWindow,
    openSettings: createDashboardWindow,
    stopAllManaged: async () => {
      const choice = dialog.showMessageBoxSync({
        type: 'warning',
        buttons: ['Stop all', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        message: 'Stop all managed services?',
        detail: 'This stops every service that Service Starter started.'
      })
      if (choice !== 0) return
      const managed = processManager.getManagedProcesses()
      await Promise.all(
        [...managed.values()].map((m) => processManager.stopComponent(m.projectName, m.componentName))
      )
    }
  })
```

- [ ] **Step 4: Expose `showContextMenu` in preload**

In `src/preload/index.ts`, add to `api`:

```typescript
  showContextMenu: (type: string, payload: unknown) =>
    ipcRenderer.send('menu:show', type, payload),
```

In `src/preload/index.d.ts`, add the type and method (define the union locally for the renderer):

```typescript
export type ContextMenuType =
  | 'running-service'
  | 'idle-service'
  | 'conflict-service'
  | 'active-project'
  | 'idle-project'
  | 'footer'

export interface ContextMenuPayload {
  projectName: string
  projectDir?: string
  componentName?: string
  port?: number
  pid?: number
}
```

```typescript
  showContextMenu: (type: ContextMenuType, payload: ContextMenuPayload) => void
```

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: PASS

```bash
git add src/main/tray/context-menus.ts src/main/ipc/channels.ts src/main/index.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: add native context menus over IPC"
```

---

### Task 10: Grow the tray window

**Files:**
- Modify: `src/main/tray/tray-window.ts`

- [ ] **Step 1: Update the constants**

In `src/main/tray/tray-window.ts`:

```typescript
const WINDOW_WIDTH = 420
const WINDOW_HEIGHT = 560
```

- [ ] **Step 2: Typecheck and commit**

Run: `npm run typecheck`
Expected: PASS

```bash
git add src/main/tray/tray-window.ts
git commit -m "feat: enlarge tray window to 420x560"
```

---

# Phase 3 — Renderer UI

> **Sequencing note.** Tasks 11–13, 16, 17 and 19 add new files or self-contained changes and keep `npm run typecheck` green. Tasks 14, 15, 18 and 20 form one **coupled cluster** — `ComponentRow` → `ProjectGroup` → the section components → `TrayDropdown` share interfaces, so a project-wide `npm run typecheck` is expected to be **red between Task 14 and Task 20** (the old `TrayDropdown`/`ProjectGroup` still pass the old props until everything is swapped). That is intentional: within the cluster each task is gated by its **isolated Vitest component test** (Vitest does not type-check, and only loads the unit under test), and the full `npm run typecheck && npm test && npm run lint && npm run build` gate runs at **Task 20 Step 7**. Commit at each step regardless; the cluster lands consistent at Task 20.

### Task 11: Extend `AppContext` with new actions

**Files:**
- Modify: `src/renderer/src/context/AppContext.tsx`

- [ ] **Step 1: Add the new methods to the context type**

In `src/renderer/src/context/AppContext.tsx`, extend `AppContextType`:

```typescript
  toggleFavorite: (projectName: string) => Promise<string[]>
  restartComponent: (projectName: string, componentName: string) => Promise<boolean>
  copyToClipboard: (text: string) => void
  editManifest: (projectDir: string) => void
  showProcessInfo: (pid: number) => void
  stopAllManaged: () => Promise<boolean>
  tailLogs: (projectName: string, componentName: string) => void
  showContextMenu: (type: string, payload: unknown) => void
```

- [ ] **Step 2: Provide defaults in the `createContext` call**

```typescript
  toggleFavorite: async () => [],
  restartComponent: async () => false,
  copyToClipboard: () => {},
  editManifest: () => {},
  showProcessInfo: () => {},
  stopAllManaged: async () => false,
  tailLogs: () => {},
  showContextMenu: () => {}
```

- [ ] **Step 3: Wire to `window.api` in the provider `value`**

```typescript
    toggleFavorite: (projectName) => window.api.toggleFavorite(projectName),
    restartComponent: (projectName, componentName) =>
      window.api.restartComponent(projectName, componentName),
    copyToClipboard: (text) => window.api.copyToClipboard(text),
    editManifest: (projectDir) => window.api.editManifest(projectDir),
    showProcessInfo: (pid) => window.api.showProcessInfo(pid),
    stopAllManaged: () => window.api.stopAllManaged(),
    tailLogs: (projectName, componentName) => window.api.tailLogs(projectName, componentName),
    showContextMenu: (type, payload) =>
      window.api.showContextMenu(type as never, payload as never)
```

- [ ] **Step 4: Typecheck and commit**

Run: `npm run typecheck`
Expected: PASS

```bash
git add src/renderer/src/context/AppContext.tsx
git commit -m "feat: expose favorites and service actions through AppContext"
```

---

### Task 12: Create the `tray/` directory and relocate existing components

**Files:**
- Move: `src/renderer/src/components/ComponentRow.tsx` → `tray/ComponentRow.tsx`
- Move: `src/renderer/src/components/ProjectGroup.tsx` → `tray/ProjectGroup.tsx`
- Modify: `src/renderer/src/components/TrayDropdown.tsx` (import path only)

- [ ] **Step 1: Move the two components with git**

```bash
mkdir -p src/renderer/src/components/tray
git mv src/renderer/src/components/ComponentRow.tsx src/renderer/src/components/tray/ComponentRow.tsx
git mv src/renderer/src/components/ProjectGroup.tsx src/renderer/src/components/tray/ProjectGroup.tsx
```

- [ ] **Step 2: Fix imports in the moved files (depth increased by one)**

In `src/renderer/src/components/tray/ComponentRow.tsx`, change the three imports:

```typescript
import { StatusBadge } from '../StatusBadge'
import { ComponentStateView } from '../../context/AppContext'
import { findBoundPort, hasBoundPort } from '../../../../shared/port-state'
```

In `src/renderer/src/components/tray/ProjectGroup.tsx`, change the two imports (the `./ComponentRow` import stays valid — same directory):

```typescript
import { ComponentRow } from './ComponentRow'
import { ProjectStateView } from '../../context/AppContext'
```

- [ ] **Step 3: Point `TrayDropdown` at the new location**

In `src/renderer/src/components/TrayDropdown.tsx`, change:

```typescript
import { ProjectGroup } from './tray/ProjectGroup'
```

- [ ] **Step 4: Typecheck and commit**

Run: `npm run typecheck`
Expected: PASS

```bash
git add src/renderer/src/components/
git commit -m "refactor: move tray components into components/tray"
```

---

### Task 13: `ContextMenuTrigger`

**Files:**
- Create: `src/renderer/src/components/tray/ContextMenuTrigger.tsx`
- Test: `src/renderer/src/components/tray/ContextMenuTrigger.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/renderer/src/components/tray/ContextMenuTrigger.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContextMenuTrigger } from './ContextMenuTrigger'

describe('ContextMenuTrigger', () => {
  it('fires onShow when the overflow button is clicked', async () => {
    const onShow = vi.fn()
    render(<ContextMenuTrigger onShow={onShow} label="More for api" />)
    await userEvent.click(screen.getByRole('button', { name: 'More for api' }))
    expect(onShow).toHaveBeenCalledTimes(1)
  })

  it('fires onShow on right-click of its wrapped children', async () => {
    const onShow = vi.fn()
    render(
      <ContextMenuTrigger onShow={onShow} label="More">
        <div>row body</div>
      </ContextMenuTrigger>
    )
    const body = screen.getByText('row body')
    body.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    expect(onShow).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- ContextMenuTrigger`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/renderer/src/components/tray/ContextMenuTrigger.tsx
import { ReactNode } from 'react'

interface ContextMenuTriggerProps {
  onShow: () => void
  label: string
  children?: ReactNode
}

/**
 * Wraps a row so that both right-click (onContextMenu) and a visible overflow
 * button raise the same native context menu via `onShow`.
 */
export function ContextMenuTrigger({
  onShow,
  label,
  children
}: ContextMenuTriggerProps): React.JSX.Element {
  return (
    <div
      className="contents"
      onContextMenu={(e) => {
        e.preventDefault()
        onShow()
      }}
    >
      {children}
      <button
        aria-label={label}
        title="More actions"
        onClick={(e) => {
          e.stopPropagation()
          onShow()
        }}
        className="p-1 rounded text-zinc-500 opacity-70 hover:opacity-100 hover:bg-white/10 hover:text-zinc-300 transition"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- ContextMenuTrigger`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/tray/ContextMenuTrigger.tsx src/renderer/src/components/tray/ContextMenuTrigger.test.tsx
git commit -m "feat: add ContextMenuTrigger component"
```

---

### Task 14: Polish `ComponentRow` (uptime, always-visible actions, overflow, selection)

**Files:**
- Modify: `src/renderer/src/components/tray/ComponentRow.tsx`
- Test: `src/renderer/src/components/tray/ComponentRow.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/renderer/src/components/tray/ComponentRow.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComponentRow } from './ComponentRow'
import { ComponentStateView } from '../../context/AppContext'

function comp(over: Partial<ComponentStateView> = {}): ComponentStateView {
  return {
    name: 'frontend',
    status: 'stopped',
    processOrigin: 'none',
    ports: [{ port: 3000, label: 'web', status: 'free' }],
    dependencies: [],
    ...over
  }
}

const noopHandlers = {
  projectName: 'bandai',
  projectDir: '/work/bandai',
  onStartComponent: vi.fn(),
  onStopComponent: vi.fn(),
  onShowContextMenu: vi.fn(),
  selected: false,
  now: 1_000_000_000_000
}

describe('ComponentRow', () => {
  it('shows a Start button for an idle component and dispatches start', async () => {
    const onStartComponent = vi.fn()
    render(<ComponentRow {...noopHandlers} component={comp()} onStartComponent={onStartComponent} />)
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onStartComponent).toHaveBeenCalledWith('bandai', 'frontend')
  })

  it('shows uptime and a Stop button for a managed running component', () => {
    render(
      <ComponentRow
        {...noopHandlers}
        component={comp({
          status: 'running',
          processOrigin: 'managed',
          startedAt: noopHandlers.now - 120_000
        })}
      />
    )
    expect(screen.getByText('2m')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('raises the context menu on overflow click', async () => {
    const onShowContextMenu = vi.fn()
    render(<ComponentRow {...noopHandlers} component={comp()} onShowContextMenu={onShowContextMenu} />)
    await userEvent.click(screen.getByRole('button', { name: /more/i }))
    expect(onShowContextMenu).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- ComponentRow`
Expected: FAIL — new props (`onShowContextMenu`, `selected`, `now`) and uptime not yet implemented.

- [ ] **Step 3: Rewrite `ComponentRow.tsx`**

```tsx
// src/renderer/src/components/tray/ComponentRow.tsx
import { StatusBadge } from '../StatusBadge'
import { ComponentStateView } from '../../context/AppContext'
import { findBoundPort, hasBoundPort } from '../../../../shared/port-state'
import { formatUptime } from '../../utils/formatUptime'
import { ContextMenuTrigger } from './ContextMenuTrigger'

interface ComponentRowProps {
  component: ComponentStateView
  projectName: string
  projectDir: string
  selected?: boolean
  now?: number
  onStartComponent: (projectName: string, componentName: string) => void
  onStopComponent: (projectName: string, componentName: string) => void
  onShowContextMenu: () => void
  onHover?: () => void
}

export function ComponentRow({
  component,
  projectName,
  projectDir,
  selected = false,
  now,
  onStartComponent,
  onStopComponent,
  onShowContextMenu,
  onHover
}: ComponentRowProps): React.JSX.Element {
  const mainPort = component.ports[0]
  const canStart = component.processOrigin === 'none' && !hasBoundPort(component.ports)
  const killablePort =
    component.processOrigin === 'external' ? findBoundPort(component.ports) : undefined
  const uptime = formatUptime(component.startedAt, now)
  const accent =
    component.status === 'warning'
      ? 'border-amber-400'
      : component.status === 'running'
        ? 'border-emerald-400'
        : 'border-transparent'

  return (
    <div
      onMouseMove={onHover}
      className={`group flex items-center gap-2 px-3 py-2 border-l transition-colors ${accent} ${
        selected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
      }`}
    >
      <StatusBadge status={component.status} />

      <span className="flex-1 min-w-0 text-[13.5px] text-zinc-300 truncate tracking-tight">
        {component.name}
      </span>

      {mainPort && (
        <span
          className={`font-mono text-[11px] tabular-nums flex-shrink-0 ${
            mainPort.status === 'conflict'
              ? 'text-amber-400'
              : mainPort.status === 'in-use'
                ? 'text-emerald-400'
                : 'text-zinc-500'
          }`}
        >
          :{mainPort.port}
        </span>
      )}

      {component.processOrigin === 'managed' && component.status === 'running' && (
        <span className="font-mono text-[11px] tabular-nums text-zinc-500 w-12 text-right flex-shrink-0">
          {uptime}
        </span>
      )}

      <div className="flex items-center gap-0.5 flex-shrink-0">
        {canStart ? (
          <RowAction icon="play" title="Start" onClick={() => onStartComponent(projectName, component.name)} />
        ) : component.processOrigin === 'managed' ? (
          <RowAction icon="stop" title="Stop" danger onClick={() => onStopComponent(projectName, component.name)} />
        ) : killablePort ? (
          <RowAction icon="kill" title={`Kill :${killablePort.port}`} danger onClick={() => onShowContextMenu()} />
        ) : null}
        <ContextMenuTrigger onShow={onShowContextMenu} label={`More actions for ${component.name}`} />
      </div>
    </div>
  )
}

function RowAction({
  icon,
  title,
  onClick,
  danger = false
}: {
  icon: 'kill' | 'play' | 'stop'
  title: string
  onClick: () => void
  danger?: boolean
}): React.JSX.Element {
  const iconMap = {
    kill: <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
    play: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
      />
    ),
    stop: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
      />
    )
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={title}
      aria-label={title}
      className={`p-1 rounded opacity-70 hover:opacity-100 transition ${
        danger
          ? 'hover:bg-red-500/20 text-zinc-500 hover:text-red-400'
          : 'hover:bg-white/10 text-zinc-500 hover:text-zinc-300'
      }`}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        {iconMap[icon]}
      </svg>
    </button>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- ComponentRow`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/tray/ComponentRow.tsx src/renderer/src/components/tray/ComponentRow.test.tsx
git commit -m "feat: polish ComponentRow with uptime, visible actions and overflow"
```

---

### Task 15: Polish `ProjectGroup` (star, controllable expansion, batch start, context menu)

**Files:**
- Modify: `src/renderer/src/components/tray/ProjectGroup.tsx`
- Test: `src/renderer/src/components/tray/ProjectGroup.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/renderer/src/components/tray/ProjectGroup.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectGroup } from './ProjectGroup'
import { ProjectStateView } from '../../context/AppContext'

function project(): ProjectStateView {
  return {
    name: 'bandai',
    directory: '/work/bandai',
    components: {
      frontend: {
        name: 'frontend',
        status: 'running',
        processOrigin: 'managed',
        ports: [{ port: 3000, label: 'web', status: 'in-use' }],
        dependencies: [],
        startedAt: Date.now()
      },
      docs: {
        name: 'docs',
        status: 'stopped',
        processOrigin: 'none',
        ports: [{ port: 3001, label: 'docs', status: 'free' }],
        dependencies: []
      }
    },
    dependencies: []
  }
}

const baseProps = {
  project: project(),
  components: Object.values(project().components).map((component) => ({
    projectName: 'bandai',
    component,
    isRunning: component.status === 'running',
    isConflicting: false
  })),
  expanded: true,
  isFavorite: false,
  runningCount: 1,
  totalCount: 2,
  onToggleExpanded: vi.fn(),
  onToggleFavorite: vi.fn(),
  onStartComponent: vi.fn(),
  onStopComponent: vi.fn(),
  onShowProjectMenu: vi.fn(),
  onShowComponentMenu: vi.fn(),
  selectedId: null as string | null,
  now: Date.now()
}

describe('ProjectGroup', () => {
  it('shows running/total and toggles favorite', async () => {
    const onToggleFavorite = vi.fn()
    render(<ProjectGroup {...baseProps} onToggleFavorite={onToggleFavorite} />)
    expect(screen.getByText('1/2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /pin bandai/i }))
    expect(onToggleFavorite).toHaveBeenCalledWith('bandai')
  })

  it('hides components when collapsed', () => {
    render(<ProjectGroup {...baseProps} expanded={false} />)
    expect(screen.queryByText('frontend')).not.toBeInTheDocument()
  })

  it('toggles expansion when the header is clicked', async () => {
    const onToggleExpanded = vi.fn()
    render(<ProjectGroup {...baseProps} onToggleExpanded={onToggleExpanded} />)
    await userEvent.click(screen.getByRole('button', { name: /bandai/i }))
    expect(onToggleExpanded).toHaveBeenCalledWith('bandai')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- ProjectGroup`
Expected: FAIL — props changed (now controlled).

- [ ] **Step 3: Rewrite `ProjectGroup.tsx`**

```tsx
// src/renderer/src/components/tray/ProjectGroup.tsx
import { ComponentRow } from './ComponentRow'
import { ProjectStateView } from '../../context/AppContext'
import { ComponentRowData } from '../../utils/sortServices'
import { ContextMenuTrigger } from './ContextMenuTrigger'

interface ProjectGroupProps {
  project: ProjectStateView
  components: ComponentRowData[]
  expanded: boolean
  isFavorite: boolean
  runningCount: number
  totalCount: number
  selectedId: string | null
  now: number
  showStar?: boolean
  onToggleExpanded: (projectName: string) => void
  onToggleFavorite: (projectName: string) => void
  onStartComponent: (projectName: string, componentName: string) => void
  onStopComponent: (projectName: string, componentName: string) => void
  onShowProjectMenu: () => void
  onShowComponentMenu: (componentName: string) => void
}

export function ProjectGroup({
  project,
  components,
  expanded,
  isFavorite,
  runningCount,
  totalCount,
  selectedId,
  now,
  showStar = false,
  onToggleExpanded,
  onToggleFavorite,
  onStartComponent,
  onStopComponent,
  onShowProjectMenu,
  onShowComponentMenu
}: ProjectGroupProps): React.JSX.Element {
  const headerSelected = selectedId === project.name
  const dotColor = runningCount > 0 ? 'bg-emerald-400' : 'bg-zinc-600'

  return (
    <div
      className="border-b border-white/[0.06] last:border-b-0"
      onContextMenu={(e) => {
        e.preventDefault()
        onShowProjectMenu()
      }}
    >
      <div
        className={`group flex items-center gap-2 px-3 py-2 transition-colors ${
          headerSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
        }`}
      >
        <button
          onClick={() => onToggleExpanded(project.name)}
          aria-label={project.name}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <svg
            className={`w-3 h-3 text-zinc-500 transition-transform duration-150 flex-shrink-0 ${
              expanded ? 'rotate-90' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
          <span className="flex-1 text-[13.5px] font-medium text-zinc-200 text-left truncate">
            {project.name}
          </span>
        </button>

        {showStar && (
          <button
            aria-label={isFavorite ? `Unpin ${project.name}` : `Pin ${project.name}`}
            title={isFavorite ? 'Unpin project' : 'Pin project'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite(project.name)
            }}
            className={`p-1 rounded transition opacity-70 hover:opacity-100 hover:bg-white/10 ${
              isFavorite ? 'text-amber-300' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.2 4.46 4.92.72-3.56 3.47.84 4.9-4.4-2.31-4.4 2.31.84-4.9-3.56-3.47 4.92-.72 2.2-4.46z" />
            </svg>
          </button>
        )}

        <ContextMenuTrigger onShow={onShowProjectMenu} label={`More actions for ${project.name}`} />

        <span className="text-[11px] font-mono text-zinc-500 tabular-nums flex-shrink-0">
          {runningCount}/{totalCount}
        </span>
      </div>

      {expanded && (
        <div className="pb-1">
          {components.map(({ component }) => (
            <ComponentRow
              key={component.name}
              component={component}
              projectName={project.name}
              projectDir={project.directory}
              selected={selectedId === `${project.name}/${component.name}`}
              now={now}
              onStartComponent={onStartComponent}
              onStopComponent={onStopComponent}
              onShowContextMenu={() => onShowComponentMenu(component.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- ProjectGroup`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/tray/ProjectGroup.tsx src/renderer/src/components/tray/ProjectGroup.test.tsx
git commit -m "feat: polish ProjectGroup with star, controlled expansion and context menu"
```

---

### Task 16: `KpiStrip` and `SearchBar`

**Files:**
- Create: `src/renderer/src/components/tray/KpiStrip.tsx`
- Create: `src/renderer/src/components/tray/SearchBar.tsx`
- Test: `src/renderer/src/components/tray/SearchBar.test.tsx`

- [ ] **Step 1: Write the failing test for `SearchBar`**

```tsx
// src/renderer/src/components/tray/SearchBar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from './SearchBar'

describe('SearchBar', () => {
  it('reports typed input through onChange', async () => {
    const onChange = vi.fn()
    render(<SearchBar value="" onChange={onChange} onFocusChange={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('Search…'), 'api')
    expect(onChange).toHaveBeenLastCalledWith('api')
  })

  it('clears the query on Escape when non-empty', async () => {
    const onChange = vi.fn()
    render(<SearchBar value="api" onChange={onChange} onFocusChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Search…')
    input.focus()
    await userEvent.keyboard('{Escape}')
    expect(onChange).toHaveBeenCalledWith('')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- SearchBar`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `SearchBar`**

```tsx
// src/renderer/src/components/tray/SearchBar.tsx
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
    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
      <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3m1.8-4.7a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
      </svg>
      <input
        ref={ref}
        value={value}
        placeholder="Search…"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value.length > 0) {
            e.preventDefault()
            e.stopPropagation()
            onChange('')
          }
        }}
        className="flex-1 min-w-0 bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none"
      />
      <kbd className="text-[10px] text-zinc-600 font-mono flex-shrink-0">⌘F</kbd>
    </div>
  )
})
```

- [ ] **Step 4: Implement `KpiStrip`**

```tsx
// src/renderer/src/components/tray/KpiStrip.tsx
interface KpiStripProps {
  running: number
  conflicts: number
}

export function KpiStrip({ running, conflicts }: KpiStripProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-4 px-3 py-1.5 border-b border-white/[0.06] bg-zinc-900/60">
      <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="font-mono tabular-nums text-zinc-300">{running}</span> running
      </span>
      {conflicts > 0 && (
        <span className="flex items-center gap-1.5 text-[11px] text-amber-400">
          <span aria-hidden>⚠</span>
          <span className="font-mono tabular-nums">{conflicts}</span>
          {conflicts === 1 ? ' conflict' : ' conflicts'}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- SearchBar`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/tray/KpiStrip.tsx src/renderer/src/components/tray/SearchBar.tsx src/renderer/src/components/tray/SearchBar.test.tsx
git commit -m "feat: add KpiStrip and SearchBar components"
```

---

### Task 17: `ConflictRow` and `ConflictsSection`

**Files:**
- Create: `src/renderer/src/components/tray/ConflictRow.tsx`
- Create: `src/renderer/src/components/tray/ConflictsSection.tsx`
- Test: `src/renderer/src/components/tray/ConflictsSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/renderer/src/components/tray/ConflictsSection.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConflictsSection } from './ConflictsSection'
import { ConflictRow } from '../../utils/sortServices'

const rows: ConflictRow[] = [
  { port: 3001, claimants: ['bandai/docs'], primaryLabel: 'bandai/docs', activePid: 42 }
]

describe('ConflictsSection', () => {
  it('renders nothing when there are no conflicts', () => {
    const { container } = render(
      <ConflictsSection conflicts={[]} selectedId={null} onKillPort={vi.fn()} onShowMenu={vi.fn()} onHover={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a header count and dispatches kill', async () => {
    const onKillPort = vi.fn()
    render(
      <ConflictsSection conflicts={rows} selectedId={null} onKillPort={onKillPort} onShowMenu={vi.fn()} onHover={vi.fn()} />
    )
    expect(screen.getByText(/CONFLICTS \(1\)/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /kill :3001/i }))
    expect(onKillPort).toHaveBeenCalledWith(3001)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- ConflictsSection`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `ConflictRow`**

```tsx
// src/renderer/src/components/tray/ConflictRow.tsx
import { ConflictRow as ConflictRowData } from '../../utils/sortServices'
import { ContextMenuTrigger } from './ContextMenuTrigger'

interface ConflictRowProps {
  conflict: ConflictRowData
  selected: boolean
  onKillPort: (port: number) => void
  onShowMenu: () => void
  onHover: () => void
}

export function ConflictRow({
  conflict,
  selected,
  onKillPort,
  onShowMenu,
  onHover
}: ConflictRowProps): React.JSX.Element {
  return (
    <div
      onMouseMove={onHover}
      onContextMenu={(e) => {
        e.preventDefault()
        onShowMenu()
      }}
      className={`group flex items-center gap-2 px-3 py-2 border-l border-amber-400 transition-colors ${
        selected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
      }`}
    >
      <span aria-hidden className="text-amber-400 text-[12px]">⚠</span>
      <span className="flex-1 min-w-0 text-[13.5px] text-zinc-300 truncate">{conflict.primaryLabel}</span>
      <span className="font-mono text-[11px] tabular-nums text-amber-400 flex-shrink-0">:{conflict.port}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onKillPort(conflict.port)
        }}
        aria-label={`Kill :${conflict.port}`}
        title={`Kill :${conflict.port}`}
        className="px-1.5 py-0.5 rounded text-[11px] text-zinc-400 opacity-70 hover:opacity-100 hover:bg-red-500/20 hover:text-red-300 transition flex-shrink-0"
      >
        kill
      </button>
      <ContextMenuTrigger onShow={onShowMenu} label={`More actions for ${conflict.primaryLabel}`} />
    </div>
  )
}
```

- [ ] **Step 4: Implement `ConflictsSection`**

```tsx
// src/renderer/src/components/tray/ConflictsSection.tsx
import { ConflictRow as ConflictRowData } from '../../utils/sortServices'
import { ConflictRow } from './ConflictRow'

interface ConflictsSectionProps {
  conflicts: ConflictRowData[]
  selectedId: string | null
  onKillPort: (port: number) => void
  onShowMenu: (conflict: ConflictRowData) => void
  onHover: (id: string) => void
}

export function ConflictsSection({
  conflicts,
  selectedId,
  onKillPort,
  onShowMenu,
  onHover
}: ConflictsSectionProps): React.JSX.Element | null {
  if (conflicts.length === 0) return null

  return (
    <div>
      <div className="sticky top-0 z-10 px-3 py-1 bg-zinc-900/60 backdrop-blur text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
        ⚠ Conflicts ({conflicts.length})
      </div>
      {conflicts.map((conflict) => {
        const id = `conflict:${conflict.port}`
        return (
          <ConflictRow
            key={id}
            conflict={conflict}
            selected={selectedId === id}
            onKillPort={onKillPort}
            onShowMenu={() => onShowMenu(conflict)}
            onHover={() => onHover(id)}
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- ConflictsSection`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/tray/ConflictRow.tsx src/renderer/src/components/tray/ConflictsSection.tsx src/renderer/src/components/tray/ConflictsSection.test.tsx
git commit -m "feat: add ConflictRow and ConflictsSection components"
```

---

### Task 18: `ActiveProjectsSection` and `IdleProjectsSection`

**Files:**
- Create: `src/renderer/src/components/tray/ActiveProjectsSection.tsx`
- Create: `src/renderer/src/components/tray/IdleProjectsSection.tsx`
- Test: `src/renderer/src/components/tray/IdleProjectsSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/renderer/src/components/tray/IdleProjectsSection.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdleProjectsSection } from './IdleProjectsSection'
import { ProjectRow } from '../../utils/sortServices'

function idleProject(name: string, favorite = false): ProjectRow {
  const component = {
    name: 'web',
    status: 'stopped' as const,
    processOrigin: 'none' as const,
    ports: [{ port: 3000, label: 'web', status: 'free' as const }],
    dependencies: []
  }
  return {
    project: { name, directory: `/work/${name}`, components: { web: component }, dependencies: [] },
    isFavorite: favorite,
    runningCount: 0,
    totalCount: 1,
    components: [{ projectName: name, component, isRunning: false, isConflicting: false }]
  }
}

const handlers = {
  expandedProjects: new Set<string>(),
  searching: false,
  selectedId: null as string | null,
  now: Date.now(),
  onToggleExpanded: vi.fn(),
  onToggleFavorite: vi.fn(),
  onStartComponent: vi.fn(),
  onStopComponent: vi.fn(),
  onShowProjectMenu: vi.fn(),
  onShowComponentMenu: vi.fn()
}

describe('IdleProjectsSection', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<IdleProjectsSection projects={[]} {...handlers} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the count and collapses children by default', () => {
    render(<IdleProjectsSection projects={[idleProject('wifi'), idleProject('x32')]} {...handlers} />)
    expect(screen.getByText(/IDLE PROJECTS \(2\)/)).toBeInTheDocument()
    expect(screen.queryByText('web')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- IdleProjectsSection`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ActiveProjectsSection`**

```tsx
// src/renderer/src/components/tray/ActiveProjectsSection.tsx
import { ProjectRow } from '../../utils/sortServices'
import { ProjectGroup } from './ProjectGroup'

interface ActiveProjectsSectionProps {
  projects: ProjectRow[]
  selectedId: string | null
  now: number
  onToggleExpanded: (projectName: string) => void
  onToggleFavorite: (projectName: string) => void
  onStartComponent: (projectName: string, componentName: string) => void
  onStopComponent: (projectName: string, componentName: string) => void
  onShowProjectMenu: (project: ProjectRow) => void
  onShowComponentMenu: (projectName: string, componentName: string) => void
  collapsedProjects: Set<string>
  searching: boolean
}

export function ActiveProjectsSection({
  projects,
  selectedId,
  now,
  onToggleExpanded,
  onToggleFavorite,
  onStartComponent,
  onStopComponent,
  onShowProjectMenu,
  onShowComponentMenu,
  collapsedProjects,
  searching
}: ActiveProjectsSectionProps): React.JSX.Element | null {
  if (projects.length === 0) return null

  return (
    <div>
      <div className="sticky top-0 z-10 px-3 py-1 bg-zinc-900/60 backdrop-blur text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        ▶ Active Projects ({projects.length})
      </div>
      {projects.map((row) => (
        <ProjectGroup
          key={row.project.name}
          project={row.project}
          components={row.components}
          expanded={searching || !collapsedProjects.has(row.project.name)}
          isFavorite={row.isFavorite}
          runningCount={row.runningCount}
          totalCount={row.totalCount}
          selectedId={selectedId}
          now={now}
          onToggleExpanded={onToggleExpanded}
          onToggleFavorite={onToggleFavorite}
          onStartComponent={onStartComponent}
          onStopComponent={onStopComponent}
          onShowProjectMenu={() => onShowProjectMenu(row)}
          onShowComponentMenu={(componentName) => onShowComponentMenu(row.project.name, componentName)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Implement `IdleProjectsSection`**

```tsx
// src/renderer/src/components/tray/IdleProjectsSection.tsx
import { ProjectRow } from '../../utils/sortServices'
import { ProjectGroup } from './ProjectGroup'

interface IdleProjectsSectionProps {
  projects: ProjectRow[]
  expandedProjects: Set<string>
  searching: boolean
  selectedId: string | null
  now: number
  onToggleExpanded: (projectName: string) => void
  onToggleFavorite: (projectName: string) => void
  onStartComponent: (projectName: string, componentName: string) => void
  onStopComponent: (projectName: string, componentName: string) => void
  onShowProjectMenu: (project: ProjectRow) => void
  onShowComponentMenu: (projectName: string, componentName: string) => void
}

export function IdleProjectsSection({
  projects,
  expandedProjects,
  searching,
  selectedId,
  now,
  onToggleExpanded,
  onToggleFavorite,
  onStartComponent,
  onStopComponent,
  onShowProjectMenu,
  onShowComponentMenu
}: IdleProjectsSectionProps): React.JSX.Element | null {
  if (projects.length === 0) return null

  return (
    <div>
      <div className="sticky top-0 z-10 px-3 py-1 bg-zinc-900/60 backdrop-blur text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        ◌ Idle Projects ({projects.length})
      </div>
      {projects.map((row) => (
        <ProjectGroup
          key={row.project.name}
          project={row.project}
          components={row.components}
          expanded={searching || expandedProjects.has(row.project.name)}
          isFavorite={row.isFavorite}
          runningCount={row.runningCount}
          totalCount={row.totalCount}
          selectedId={selectedId}
          now={now}
          showStar
          onToggleExpanded={onToggleExpanded}
          onToggleFavorite={onToggleFavorite}
          onStartComponent={onStartComponent}
          onStopComponent={onStopComponent}
          onShowProjectMenu={() => onShowProjectMenu(row)}
          onShowComponentMenu={(componentName) => onShowComponentMenu(row.project.name, componentName)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- IdleProjectsSection`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/tray/ActiveProjectsSection.tsx src/renderer/src/components/tray/IdleProjectsSection.tsx src/renderer/src/components/tray/IdleProjectsSection.test.tsx
git commit -m "feat: add ActiveProjectsSection and IdleProjectsSection"
```

---

### Task 19: `FooterActions`

> `PortSummary` is **not** deleted here — the not-yet-reworked `TrayDropdown` still imports it. Its deletion happens in Task 20, once `TrayDropdown` no longer references it.

**Files:**
- Create: `src/renderer/src/components/tray/FooterActions.tsx`
- Test: `src/renderer/src/components/tray/FooterActions.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/renderer/src/components/tray/FooterActions.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FooterActions } from './FooterActions'

describe('FooterActions', () => {
  it('renders the port/project summary', () => {
    render(<FooterActions activePorts={5} totalPorts={9} projectCount={3} onShowMenu={vi.fn()} />)
    expect(screen.getByText(/5\/9 ports/)).toBeInTheDocument()
    expect(screen.getByText(/3 projects/)).toBeInTheDocument()
  })

  it('opens the footer menu on the overflow button', async () => {
    const onShowMenu = vi.fn()
    render(<FooterActions activePorts={0} totalPorts={0} projectCount={0} onShowMenu={onShowMenu} />)
    await userEvent.click(screen.getByRole('button', { name: /more/i }))
    expect(onShowMenu).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- FooterActions`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `FooterActions`**

```tsx
// src/renderer/src/components/tray/FooterActions.tsx
import { ContextMenuTrigger } from './ContextMenuTrigger'

interface FooterActionsProps {
  activePorts: number
  totalPorts: number
  projectCount: number
  onShowMenu: () => void
}

export function FooterActions({
  activePorts,
  totalPorts,
  projectCount,
  onShowMenu
}: FooterActionsProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.06] bg-black/20">
      <span className="text-[11px] text-zinc-500">
        <span className="font-mono tabular-nums text-zinc-400">{activePorts}</span>
        <span className="mx-0.5">/</span>
        <span className="font-mono tabular-nums">{totalPorts}</span> ports · {projectCount}{' '}
        {projectCount === 1 ? 'project' : 'projects'}
      </span>
      <ContextMenuTrigger onShow={onShowMenu} label="More actions" />
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- FooterActions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/tray/FooterActions.tsx src/renderer/src/components/tray/FooterActions.test.tsx
git commit -m "feat: add FooterActions component"
```

---

### Task 20: Rework `TrayDropdown` (orchestrator: search, keyboard, sections)

**Files:**
- Move + rewrite: `src/renderer/src/components/TrayDropdown.tsx` → `tray/TrayDropdown.tsx`
- Test: `src/renderer/src/components/tray/TrayDropdown.test.tsx`
- Modify: `src/renderer/src/App.tsx`
- Delete: `src/renderer/src/components/PortSummary.tsx` (now unreferenced)

- [ ] **Step 1: Move the file**

```bash
git mv src/renderer/src/components/TrayDropdown.tsx src/renderer/src/components/tray/TrayDropdown.tsx
```

- [ ] **Step 2: Update the App import**

In `src/renderer/src/App.tsx`:

```typescript
import { TrayDropdown } from './components/tray/TrayDropdown'
```

- [ ] **Step 3: Write the failing integration test**

```tsx
// src/renderer/src/components/tray/TrayDropdown.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProvider, AppStateView } from '../../context/AppContext'
import { TrayDropdown } from './TrayDropdown'

function buildState(): AppStateView {
  return {
    trayIcon: 'green',
    conflicts: [],
    favorites: [],
    projects: {
      bandai: {
        name: 'bandai',
        directory: '/work/bandai',
        dependencies: [],
        components: {
          frontend: {
            name: 'frontend',
            status: 'running',
            processOrigin: 'managed',
            ports: [{ port: 3000, label: 'web', status: 'in-use' }],
            dependencies: [],
            startedAt: Date.now() - 120_000
          },
          docs: {
            name: 'docs',
            status: 'stopped',
            processOrigin: 'none',
            ports: [{ port: 3001, label: 'docs', status: 'free' }],
            dependencies: []
          }
        }
      },
      idleproj: {
        name: 'idleproj',
        directory: '/work/idleproj',
        dependencies: [],
        components: {
          web: {
            name: 'web',
            status: 'stopped',
            processOrigin: 'none',
            ports: [{ port: 8080, label: 'web', status: 'free' }],
            dependencies: []
          }
        }
      }
    }
  }
}

const startComponent = vi.fn()

beforeEach(() => {
  startComponent.mockReset()
  // Stub the preload bridge used by AppContext + TrayDropdown.
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getState: () => Promise.resolve(buildState()),
    onStateUpdate: () => () => {},
    getFavorites: () => Promise.resolve([]),
    toggleFavorite: () => Promise.resolve([]),
    startComponent,
    stopComponent: vi.fn(),
    startProject: vi.fn(),
    stopProject: vi.fn(),
    restartComponent: vi.fn(),
    stopAllManaged: vi.fn(),
    copyToClipboard: vi.fn(),
    editManifest: vi.fn(),
    showProcessInfo: vi.fn(),
    tailLogs: vi.fn(),
    showContextMenu: vi.fn(),
    openDashboard: vi.fn(),
    openTerminal: vi.fn(),
    openEditor: vi.fn(),
    openGitGui: vi.fn(),
    killPort: () => Promise.resolve(true),
    closeWindow: vi.fn()
  }
})

function renderTray() {
  return render(
    <AppProvider>
      <TrayDropdown />
    </AppProvider>
  )
}

describe('TrayDropdown', () => {
  it('shows active and idle sections from state', async () => {
    renderTray()
    expect(await screen.findByText(/Active Projects \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Idle Projects \(1\)/)).toBeInTheDocument()
    expect(screen.getByText('frontend')).toBeInTheDocument()
  })

  it('filters rows by search query', async () => {
    renderTray()
    await screen.findByText('frontend')
    await userEvent.type(screen.getByPlaceholderText('Search…'), 'docs')
    await waitFor(() => expect(screen.queryByText('frontend')).not.toBeInTheDocument())
    expect(screen.getByText('docs')).toBeInTheDocument()
  })

  it('starts an idle component via its Start button', async () => {
    renderTray()
    const docsRow = (await screen.findByText('docs')).closest('div')!
    const startBtn = docsRow.querySelector('button[aria-label="Start"]') as HTMLButtonElement
    await userEvent.click(startBtn)
    expect(startComponent).toHaveBeenCalledWith('bandai', 'docs')
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- TrayDropdown`
Expected: FAIL — `TrayDropdown` still renders the old flat list.

- [ ] **Step 5: Rewrite `TrayDropdown.tsx`**

```tsx
// src/renderer/src/components/tray/TrayDropdown.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppState } from '../../context/AppContext'
import { isPortBound } from '../../../../shared/port-state'
import { sortServices, ProjectRow, ConflictRow } from '../../utils/sortServices'
import { searchMatcher } from '../../utils/searchMatcher'
import { KpiStrip } from './KpiStrip'
import { SearchBar } from './SearchBar'
import { ConflictsSection } from './ConflictsSection'
import { ActiveProjectsSection } from './ActiveProjectsSection'
import { IdleProjectsSection } from './IdleProjectsSection'
import { FooterActions } from './FooterActions'

interface FlatRow {
  id: string
  kind: 'conflict' | 'project' | 'component'
  projectName: string
  componentName?: string
}

export function TrayDropdown(): React.JSX.Element {
  const ctx = useAppState()
  const { state } = ctx
  const searchRef = useRef<HTMLInputElement>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collapsedActive, setCollapsedActive] = useState<Set<string>>(new Set())
  const [expandedIdle, setExpandedIdle] = useState<Set<string>>(new Set())
  const now = Date.now()

  const sections = useMemo(() => sortServices(state, state.favorites), [state])

  // Apply the search filter to component rows and conflicts.
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

    const conflicts: ConflictRow[] = sections.conflicts.filter((c) =>
      searchMatcher(searchQuery, { projectName: c.primaryLabel, ports: [c.port] })
    )
    const active = sections.active.map(matchProject).filter((r): r is ProjectRow => r !== null)
    const idle = sections.idle.map(matchProject).filter((r): r is ProjectRow => r !== null)
    return { conflicts, active, idle }
  }, [sections, searchQuery])

  const searching = searchQuery.trim() !== ''

  // Flattened, navigable rows in display order (headers are navigable).
  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = []
    for (const c of filtered.conflicts) {
      rows.push({ id: `conflict:${c.port}`, kind: 'conflict', projectName: c.primaryLabel })
    }
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

  // Footer metrics.
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

  // Keep selection valid as the visible set changes.
  useEffect(() => {
    if (selectedId && !flatRows.some((r) => r.id === selectedId)) setSelectedId(null)
  }, [flatRows, selectedId])

  const empty = Object.keys(state.projects).length === 0

  return (
    <div
      onKeyDown={onKeyDown}
      tabIndex={-1}
      className="w-[420px] max-h-[560px] flex flex-col bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-white/[0.08] shadow-2xl shadow-black/50 overflow-hidden outline-none"
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Services</span>
        <button onClick={ctx.openDashboard} className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors">
          Dashboard &rarr;
        </button>
      </div>

      <KpiStrip running={runningCount} conflicts={state.conflicts.length} />
      <SearchBar ref={searchRef} value={searchQuery} onChange={setSearchQuery} onFocusChange={setIsSearchFocused} />

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
            <ConflictsSection
              conflicts={filtered.conflicts}
              selectedId={selectedId}
              onKillPort={(port) => ctx.killPort(port)}
              onShowMenu={(c) =>
                ctx.showContextMenu('conflict-service', {
                  projectName: c.primaryLabel,
                  componentName: c.claimants[0]?.split('/')[1],
                  port: c.port,
                  pid: c.activePid
                })
              }
              onHover={setSelectedId}
            />
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
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- TrayDropdown`
Expected: PASS

- [ ] **Step 7: Delete the now-unreferenced `PortSummary`**

```bash
git rm src/renderer/src/components/PortSummary.tsx
```

- [ ] **Step 8: Typecheck, full test run, lint, build (the cluster gate)**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: PASS (all four). This is the point at which project-wide typecheck returns to green after the coupled-cluster rewrite.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/components/tray/TrayDropdown.tsx src/renderer/src/components/tray/TrayDropdown.test.tsx src/renderer/src/App.tsx src/renderer/src/components/PortSummary.tsx
git commit -m "feat: rework TrayDropdown with sections, search and keyboard navigation"
```

---

# Phase 4 — Integration & manual verification

### Task 21: Manual verification, polish pass, and cleanup

**Files:**
- (No new files — verification + any fixups surfaced by manual testing.)

- [ ] **Step 1: Build and launch the app**

Run: `npm run dev`
Expected: App launches; tray dropdown opens at 420×560 with KPI strip, search bar, and sections.

- [ ] **Step 2: Walk the manual test plan from the spec**

Verify each, fixing issues as they surface (re-run `npm run typecheck && npm test` after any fix):
- Start 5 services across 3 projects → Active Projects lists them; Idle Projects collapsed.
- Start 2 of 4 components in one project → project is Active; the 2 idle siblings remain visible and startable.
- Introduce a port conflict → Conflicts section appears at top with the kill action.
- Pin a project → floats to top of Idle with a filled star; unpin reverses; survives an app relaunch (favorites.json in userData).
- Type `:30` in search → only rows with ports starting `30` remain.
- `⌘F`, `↑`, `↓`, `Enter`, `s`, `x`, `Esc` behave per the keyboard model.
- Right-click each row type (running/idle/conflict service, active/idle project, footer) → native macOS menu with the correct items; each item performs its action.
- Footer "Stop all managed services…" → confirmation dialog, then all managed processes stop.
- Kill Service Starter while services run, relaunch → Active Projects reflects still-alive PIDs with correct uptime.

- [ ] **Step 3: Confirm no stray references to the removed `PortSummary`**

Run: `grep -rn "PortSummary" src` — Expected: no matches.

- [ ] **Step 4: Final verification before wrap-up**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 5: Commit any fixups**

```bash
git add -A
git commit -m "fix: address issues found during manual tray verification"
```

---

## Notes for the implementer

- **`now` injection.** `formatUptime` and the row components accept a `now` parameter so uptime is testable deterministically. In production `TrayDropdown` passes `Date.now()` once per render; uptime advances on each state push (every few seconds), which is sufficient for v1 — no per-second ticker is required.
- **Selection ↔ hover sync.** Hover sets `selectedId` via `onHover`/`onMouseMove`; keyboard navigation sets the same state, so the two stay in sync (spec requirement).
- **Search auto-expands groups.** While a query is active, both section components receive `searching` and force their matched children visible (`expanded={searching || …}`), and `TrayDropdown.flatRows` includes those same children. This keeps keyboard navigation and visual rendering in agreement during search. When the query is cleared, the manual `collapsedActive` / `expandedIdle` sets take over again.
- **`x` key.** Per spec, `x` "opens the selected running service stop action without immediately stopping" — implemented by popping that row's native context menu (which contains Stop), not by calling stop directly.
- **Native menu vs. blur-hide (verify in Task 21).** `TrayWindow` hides itself on `blur` (`tray-window.ts`). Popping a native `Menu` can blur the BrowserWindow, which would hide the dropdown out from under the menu. If manual testing shows the dropdown vanishing when a context menu opens, guard the blur-hide while a menu is open — e.g. set a `menuOpen` flag in `tray-window.ts` and skip `hide()` on blur when it is set, clearing it on the menu's `menu-will-close`/callback. This is the most likely runtime issue in this plan; budget time for it.
- **`useServiceState` becomes orphaned.** After the rework, `TrayDropdown` uses `useAppState` directly and nothing imports `src/renderer/src/hooks/useServiceState.ts`. Leaving it is harmless (it won't fail typecheck or lint); deleting it is a safe optional cleanup if you confirm no other consumer via `grep -rn useServiceState src`.
