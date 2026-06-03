# Dashboard Window Rework

## Summary

Rework the large dashboard/settings window. The tray menu redesign (`2026-04-24-tray-menu-redesign-design.md`) made the tray a capable command surface — search, KPI strip, active/idle grouping, favorites, per-component and per-project start/stop, native context menus, footer batch actions. As a result the dashboard's current **Projects** tab is now ~90% redundant with the tray (same `ProjectCard` → `ComponentDetail` start/stop/terminal/editor pattern, just larger).

The reworked dashboard becomes **"the deep view"**: the place for things the tray cannot do well — live logs front-and-center, cross-project port/conflict overview, dependency health, resolved env, and a properly reworked Settings surface. It is a **master/detail** window: a project/component tree on the left, a routed detail panel on the right.

**The tray is explicitly out of scope and must not change.** All `src/main` process/monitoring/discovery logic stays untouched except for two additive IPC handlers.

## Decisions

- **Role**: Framing "A — the deep view". Tray = quick day-to-day control; dashboard = observability + config. Projects stays, but earns its place by being genuinely richer than the tray (live logs, scoped ports/deps/env), not a bigger menu.
- **Layout**: Master/detail. Left = project tree (with a pinned Overview node); right = detail panel routed by current selection.
- **Navigation**: Top nav collapses to two items — **Projects · Settings**. Port Map and Dependencies are *not* top-level tabs; they fold into the master/detail (framing "C").
- **Overview node**: A pinned home node at the top of the tree. It is the default selection when the window opens and holds the cross-project views that don't belong to any single component: KPIs, the conflicts table, and the global port map.
- **Tree ordering**: Projects listed **flat, alphabetical**. Deliberately *not* the tray's floating active/idle grouping — a persistent window should not reflow under the user.
- **Conflicts**: Surfaced in the Overview detail (cross-project table) and as a `⚠` badge on affected component rows that bubbles up to a collapsed parent project.
- **Logs**: Per-component only in v1. Live tail reusing the existing `LogStreamer` infra. Combined/interleaved project logs are out of scope.
- **Logs availability**: Only **managed** processes have log files. External/unmanaged components show a clear "No logs — external process" empty state.
- **Settings**: Full rework (no auto-detect). Native OS folder picker for scan directories, sectioned layout with descriptions, real dirty/save state, restyled controls.
- **Window**: 900×670 default, made **resizable** with a min size (~720×480).
- **Visuals**: Brought up to the tray's standard — same zinc palette, typography, selection accent, sticky headers. Reuse `StatusBadge`.

## Architecture

### Navigation shell

`DashboardWindow.tsx` (reworked) owns:

- Top nav: **Projects · Settings** (keeps the existing macOS drag region / title bar).
- The current view (`'projects' | 'settings'`).
- The current tree **selection** (`{ kind: 'overview' } | { kind: 'project', projectName } | { kind: 'component', projectName, componentName }`), defaulting to `overview`.
- Local expand/collapse state for the tree.

Selection persists across `AppState` updates so a live state refresh does not reset what the user is looking at.

### Renderer layout

```
┌─ Service Starter ──────────────────────────────────────────────┐
│ Projects · Settings                                            │
├──────────────────┬─────────────────────────────────────────────┤
│ ▸ Overview       │  routed detail panel (see below)            │
│ ──────────────   │                                             │
│ ▾ shop-platform  │                                             │
│   ● backend :8090│                                             │
│   ● frontend:3000│                                             │
│   ◌ worker       │                                             │
│ ▸ analytics  ⚠  │                                             │
│   ◌ api          │                                             │
└──────────────────┴─────────────────────────────────────────────┘
```

### Left panel — `ProjectTree.tsx`

- Pinned **Overview** node at the top.
- Projects flat A→Z; each expandable to its components.
- Component rows: status dot (reuse `StatusBadge`), name, port hint.
- Conflict `⚠` badge on affected component rows; bubbles to the parent project header when the project is collapsed.
- Selection is controlled by `DashboardWindow`; expand/collapse is local to the tree.

### Right panel — routed by selection

**Overview (home) — `OverviewDetail.tsx`** (absorbs `PortMapTab` + `ConflictWarningBanner`)

- KPI header: `running · ports · ⚠ conflicts`.
- Cross-project **Conflicts** table (only when conflicts exist).
- Global **Port Map**: sortable table across all projects (port, label, project, component, status, process/pid).

**Project selected — `ProjectDetail.tsx`**

- Rollup header: `N/M running`, **Start all** / **Stop all** actions.
- Aggregate port list for the project.
- Project-level dependency health.
- A row per component that links into that component's Logs.

**Component selected — `ComponentDetail.tsx`**

- Header: name · status · uptime · pid · port · primary action (**Start** / **Stop** / **Restart**).
- Tabbed detail:

```
┌─ Logs ─ Ports ─ Deps ─ Env ─────────────────┐
```

- **`LogsTab.tsx`** — reworks the old `LogViewer` modal into an inline tab. Live tail via `getLog` + `startLogTail`/`stopLogTail` + `onLogData`. Follow-to-bottom toggle (preserve existing auto-scroll-on-near-bottom behavior), copy, clear-view. External/unmanaged process → "No logs — external process" empty state.
- **`PortsTab.tsx`** — this component's ports.
- **`DepsTab.tsx`** — this component's dependency health.
- **`EnvTab.tsx`** — resolved env vars for this component (needs new IPC, see below).

### Settings — `SettingsView.tsx` (reworked `SettingsTab`)

- **Scan directories**: native OS folder picker via new `dialog:selectDirectory` IPC (no more typing paths). Existing directories listed with remove buttons.
- Sectioned layout with descriptions: Scan Directories, Scan Intervals, Applications (editor / terminal / git GUI dropdowns kept, restyled).
- Real **dirty/save state**: Save disabled until a field changes; explicit "Saved" confirmation; revert-on-load.

### Window & visuals

- `src/main/index.ts` `createDashboardWindow`: keep 900×670 as default; add `resizable: true`, `minWidth: 720`, `minHeight: 480`.
- Visual language matched to the tray: zinc palette, typography scale, `bg-white/[0.06]` selection accent, sticky section headers, `StatusBadge` reuse.

### Component architecture

```
src/renderer/src/components/dashboard/
  DashboardWindow.tsx      (reworked) shell + nav + selection state
  ProjectTree.tsx          (new) left panel: Overview node + project/component tree
  OverviewDetail.tsx       (new) KPI + conflicts + global port map
  ProjectDetail.tsx        (new) project rollup
  ComponentDetail.tsx      (new) header + detail tabs
  LogsTab.tsx              (new) inline live log tail (replaces LogViewer modal)
  PortsTab.tsx             (new) scoped ports
  DepsTab.tsx              (new) scoped dependency health
  EnvTab.tsx               (new) resolved env vars
  SettingsView.tsx         (reworked SettingsTab)

removed / absorbed:
  ProjectsTab.tsx          (card list — redundant with tray)
  PortMapTab.tsx           (→ OverviewDetail)
  DependenciesTab.tsx      (→ OverviewDetail rollup + scoped DepsTab)
  ConflictWarningBanner.tsx(→ OverviewDetail)
  LogViewer.tsx            (→ LogsTab)
```

### IPC additions (additive; tray untouched)

```ts
interface Api {
  // existing …
  selectDirectory(): Promise<string | null>          // native folder picker
  getComponentEnv(projectName: string, componentName: string): Promise<Record<string, string>>
}
```

- `dialog:selectDirectory` — main calls `dialog.showOpenDialog({ properties: ['openDirectory'] })`, returns the chosen path or `null`.
- `component:get-env` — main resolves env for the component via the existing `env-resolver` and returns a flat `Record<string, string>`.

All other `src/main` logic (process manager, monitoring, discovery, tray, context menus) is unchanged.

## Testing

### Keep untouched
- Existing pure-util tests (`sortServices`, `searchMatcher`, `formatUptime`, `favorites`, `port-state`, etc.).

### New
- **Selection routing** — Overview / project / component selections render the correct detail panel.
- **Settings dirty/save state** — Save disabled until a field changes; folder picker adds a directory; remove works; "Saved" confirmation shows.
- **Conflict badge bubbling** — a conflicted component shows `⚠`; collapsing its parent bubbles the badge to the project row.
- **Logs external-process empty state** — a component with no log file renders the "No logs — external process" state rather than an empty stream.

### Manual test plan
- Open dashboard → Overview is selected, KPIs + (any) conflicts + global port map render.
- Introduce a cross-project port conflict → it appears in the Overview Conflicts table and as `⚠` in the tree.
- Select a project → rollup, Start all / Stop all, aggregate ports, project deps.
- Select a managed running component → live logs stream and follow; copy and clear-view work; Ports/Deps/Env tabs populate.
- Select an external component → Logs shows the empty state.
- Settings → folder picker adds a directory; Save is disabled until a change; "Saved" confirms; reopen reflects persisted values.
- Resize the window down to the min size; master/detail stays usable.
- Confirm the tray menu is visually and behaviorally unchanged.

## Out of scope (v1)

- Combined/interleaved project logs
- Log search / filter / level highlighting
- Metrics & history (CPU, memory, request rate, uptime charts)
- Auto-detect installed editor/terminal/git apps
- Light mode / theming
- Drag-to-reorder projects
- Any change to the tray menu or `src/main` process/monitoring logic beyond the two additive IPC handlers
