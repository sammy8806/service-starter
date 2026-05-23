# Tray Menu Redesign

## Summary

Complete rework of the tray dropdown menu. The current menu is a flat list of projects with expand/collapse and hover-only actions. It does not scale well when many services run simultaneously, lacks discovery of secondary actions, and has no search, batch actions, or metrics.

The new menu is a hybrid of a "command palette" (persistent search + keyboard navigation) and a "dashboard list" (KPI strip, smart grouping, inline metrics). Services that are running are flattened to the top level; idle services remain grouped by project and collapsed. Every row exposes a right-click context menu with secondary actions.

## Decisions

- **Direction**: Hybrid of Option 1 (command palette) and Option 2 (dashboard + smart list), optimized for the "many running services at once" workflow.
- **Search**: Persistent search bar (not hidden behind `⌘F`); matches on `project/component` and port number; simple substring + token match (no fuzzy lib in v1).
- **Grouping**: Three auto-managed sections in this order — `Conflicts`, `Running`, `Idle`.
- **Running section**: Flat list of `project/component` rows, not nested inside project groups.
- **Idle section**: Project-nested, collapsed by default, expand on click or `Enter` when focused.
- **Favorites**: Stars (⭐) pin a project to the top of the Idle section. Persisted to disk.
- **Actions**: Primary actions are always visible (no hover-only). Secondary actions live in the right-click context menu.
- **Context menus**: Native Electron `Menu.buildFromTemplate` via IPC, not a React portal.
- **Metrics**: Uptime only in v1. CPU / memory / request rate are out of scope.
- **Keyboard**: `⌘F` focus search, `↑/↓` move selection, `Enter` default action, `s` start, `x` stop, `Esc` clear search / blur.
- **Window size**: Grows from 360x480 to 360x560 to accommodate KPI strip + search bar.
- **Batch action**: "Stop all" stops every managed running service, with a confirmation dialog.

## Architecture

### Renderer layout

```
┌──────────────────────────────────────────────┐
│ SERVICES                        Dashboard →  │  Header
├──────────────────────────────────────────────┤
│ ▶ 5 running   ⚠ 1 conflict    [⏹ Stop all]  │  KpiStrip
├──────────────────────────────────────────────┤
│ 🔍 Search…                            ⌘F     │  SearchBar
├──────────────────────────────────────────────┤
│ ⚠ CONFLICTS (1)                              │  ConflictsSection
│   ⚠ bandai/docs       :3001       [kill]     │
│                                              │
│ ▶ RUNNING (5)                                │  RunningSection
│   ● bandai/frontend   :3000  2m  [⏹][<>]    │    (flat rows)
│   ● bandai/backend    :8090  2m  [⏹][<>]    │
│   ● mflow/api         :4000  1h  [⏹][<>]    │
│                                              │
│ ◌ IDLE (3)                                   │  IdleSection
│ ▸ ⭐ bandai           0/4                     │    (project-nested,
│ ▸    mflow            0/1                     │     collapsed)
├──────────────────────────────────────────────┤
│ 5/9 ports · 3 projects · ⌘, settings         │  Footer
└──────────────────────────────────────────────┘
```

### New components (`src/renderer/src/components/tray/`)

- `TrayDropdown.tsx` (reworked) — orchestrator; owns search state, keyboard selection, and section order
- `KpiStrip.tsx` — running/conflict counts + "Stop all" button
- `SearchBar.tsx` — input with `⌘F` focus + `Esc` clear
- `ConflictsSection.tsx` — always visible when any conflicts exist; red accent
- `RunningSection.tsx` — flat list of running services, one `FlatServiceRow` per component
- `IdleSection.tsx` — project-grouped, collapsed-by-default; reuses a polished `ProjectGroup`
- `FlatServiceRow.tsx` — new row type used in Running and Conflicts (shows `project/component`, port, uptime, actions)
- `ProjectGroup.tsx` (kept, polished) — only used inside Idle; star button, batch start
- `ComponentRow.tsx` (kept, polished) — only used when an Idle project is expanded
- `ContextMenuTrigger.tsx` — thin wrapper attaching `onContextMenu` → IPC

### New shared utilities (`src/renderer/src/utils/`)

- `sortServices.ts` — pure function producing the ordered sections from `AppStateView`
- `searchMatcher.ts` — matches a query string against a service row
- `formatUptime.ts` — `12s`, `2m`, `1h 3m`, `2d 4h`

### Favorites (`src/main/config/favorites.ts`)

New module that persists a `Set<projectName>` to `favorites.json` in Electron's `userData` directory.

- `loadFavorites(): Promise<string[]>`
- `toggleFavorite(projectName: string): Promise<string[]>` — returns new list
- `isFavorite(projectName: string): boolean`

Exposed via IPC:
- `favorites:get` → `string[]`
- `favorites:toggle` → new `string[]`
- `favorites:changed` (push) → new `string[]`

`AppStateView` gains a `favorites: string[]` field so the renderer can sort and render stars.

### Uptime tracking

`ProcessManager` already records a `startedAt` in its per-process state. Add `startedAt?: number` to `ComponentStateView` (milliseconds epoch). For external processes we do not have a reliable start time — leave `startedAt` undefined and render `—` or no uptime.

### Context menus (Electron-native)

New module `src/main/tray/context-menus.ts`:

```ts
type ContextMenuType =
  | 'running-service'
  | 'idle-service'
  | 'conflict-service'
  | 'idle-project'

interface ContextMenuPayload {
  projectName: string
  componentName?: string  // omitted for 'idle-project'
  port?: number
}

function showContextMenu(type: ContextMenuType, payload: ContextMenuPayload): void
```

Menu contents:

- **running-service**: Stop, Restart, ─, Open Terminal, Open Editor, Open Git GUI, ─, Copy URL, Copy Port, Tail Logs, ─, Pin Project, Settings…
- **idle-service**: Start, ─, Open Terminal, Open Editor, Open Git GUI, ─, Copy Port, ─, Pin Project, Edit Manifest, Settings…
- **conflict-service**: Kill Port, Show Process Info, ─, Open Terminal, Open Editor, ─, Copy PID, Copy Port
- **idle-project**: Start all, ─, Open Terminal, Open Editor, Open Git GUI, ─, Pin/Unpin, Edit Manifest

Menu items dispatch the same IPC calls used by the always-visible buttons plus a few new ones:

- `service:restart` — stop then start
- `service:tail-logs` — open dashboard Logs tab for this component
- `service:copy-url` — `clipboard.writeText('http://localhost:<port>')`
- `service:copy-port` — `clipboard.writeText(String(port))`
- `service:copy-pid` — `clipboard.writeText(String(pid))`
- `service:edit-manifest` — open `.service-starter.yml` in default editor
- `service:show-process-info` — shows a native dialog with PID / process name / start time

### IPC additions (preload API)

```ts
interface Api {
  // existing …
  getFavorites(): Promise<string[]>
  toggleFavorite(projectName: string): Promise<string[]>
  showContextMenu(type: ContextMenuType, payload: ContextMenuPayload): void
  restartComponent(projectName: string, componentName: string): Promise<void>
  copyToClipboard(text: string): void
  editManifest(projectDir: string): void
  showProcessInfo(pid: number): void
}
```

### Keyboard model

State in `TrayDropdown`:

- `selectedId: string | null` — `projectName/componentName` or `projectName` for idle project headers
- `searchQuery: string`
- `isSearchFocused: boolean`

Rules:

- `⌘F` focuses `SearchBar`, selects existing query text.
- Typing while a row is selected (not search) also focuses search and appends.
- `↑/↓` moves through the flattened visible-rows list, skipping section headers.
- `Enter` on a Running row → focus the dashboard at that component; on an Idle project → expand/collapse; on an Idle service row → start it.
- `s` / `x` start / stop the selected row's service.
- `Esc` — if search has a query, clears it; otherwise closes the tray window.
- When mouse moves, selection follows hover so keyboard and mouse stay in sync.

### Search matching

`searchMatcher(query, row)`:

1. Lowercase both sides.
2. Tokenize query on whitespace.
3. Every token must appear as a substring in `projectName/componentName` OR as a prefix of a port number.
4. Empty query matches everything.

Simple and predictable, no scoring. Upgrade to a fuzzy matcher later if needed.

### Sort / priority

`sortServices(state, favorites)` produces:

```ts
interface SortedSections {
  conflicts: FlatRow[]   // every conflict, sorted by project then component
  running:   FlatRow[]   // every running component (managed OR external)
  idle:      ProjectRow[] // projects where NO component is running
}
```

Within each list:

- Conflicts: by project name, then component name.
- Running: by project name, then component name. (Favorites do NOT float here — once running, uptime/order matters more.)
- Idle: favorites first (by name), then rest (by name).

A project appears in **only one** of Running or Idle — never both. If *any* component of the project is running, all of that project's non-running components still show as running-section empty rows? **No.** Non-running components of a partially running project are omitted from the tray entirely; the user opens the dashboard to see them. This is an opinionated simplification — it keeps the tray focused on active work.

### Window size change

`src/main/tray/tray-window.ts`:

- `WINDOW_HEIGHT: 480 → 560`
- `WINDOW_WIDTH` unchanged at 360.

## Visual / polish details

- Typography: bump primary row text from `13px` to `13.5px`; increase section label tracking; use `zinc-400` (not `zinc-500`) for slightly higher contrast on dark background.
- Row height: `py-1.5 → py-2` for easier clicking.
- Section headers: sticky within scroll, subtle bg `bg-zinc-900/60 backdrop-blur` so they don't vanish when scrolling.
- Action buttons: always visible; use `opacity-60 hover:opacity-100` instead of `opacity-0 group-hover:opacity-100`.
- Uptime text: mono, `text-zinc-500`, right-aligned next to port.
- Selected row: `bg-white/[0.06]` + 1px left border accent in the row's status color.
- Animations: fade-in new rows on state change; no layout thrash.

## Testing

### Unit tests

- `sortServices.test.ts` — running float up, idle grouped, favorites sort, conflicts always first.
- `searchMatcher.test.ts` — token match, port prefix, case-insensitive, empty query.
- `formatUptime.test.ts` — boundary cases (0, 59s, 60s, 59m, 60m, 24h, etc.).
- `favorites.test.ts` — load / toggle / persist round-trip.

### Manual test plan

- Start 5 services across 3 projects; verify flat Running list and collapsed Idle list.
- Introduce a port conflict; verify Conflicts section appears at top.
- Pin a project; verify it floats to top of Idle with star; unpin reverses.
- Type `:30` in search; verify only rows with ports starting `30` remain.
- `⌘F`, `↑`, `↓`, `Enter`, `s`, `x`, `Esc` all behave per keyboard model.
- Right-click each row type; verify native macOS menu with correct items; each item works.
- "Stop all" confirmation + stops every managed process.
- Kill Service Starter while services run; relaunch; Running list reflects still-alive PIDs with correct uptime.

## Out of scope (explicit)

- CPU / memory / network metrics
- Drag-to-reorder projects
- Log streaming preview inside the tray
- Card-based layout
- Custom keybinding configuration
- Multi-select batch actions on arbitrary rows
- Themes / light mode

## Open questions (answered)

- *Native vs React context menus?* → Native (Electron `Menu.buildFromTemplate` via IPC).
- *Where do partially-running projects live?* → Their running components show in Running section; non-running components are hidden until the dashboard is opened.
- *Should search include component paths or config fields?* → v1: `project/component` string + port. Can extend later.
