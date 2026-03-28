# Implementation Plan: Service Starter

## Context

Building a system tray application that auto-discovers projects in configurable directories, monitors port usage, detects conflicts, tracks dependency health (Docker, external services, APIs), and provides quick actions. Full spec: `docs/superpowers/specs/2026-03-28-service-starter-design.md`.

## Step 1: Project Scaffolding

Scaffold the Electron app using `electron-vite` with the `react-ts` template:

```bash
npm create @quick-start/electron@latest service-starter -- --template react-ts
```

Then move the generated files into the existing repo (since we already have git initialized with the spec). Install additional dependencies:

- `js-yaml` + `@types/js-yaml` — config parsing
- `chokidar` — file watching
- `dockerode` + `@types/dockerode` — Docker monitoring
- `tailwindcss` + `postcss` + `autoprefixer` — styling

Configure Tailwind for the renderer. Verify the app launches with `npm run dev` and shows in the system tray.

**Files created/modified:**
- `electron.vite.config.ts`
- `package.json`
- `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
- `src/main/index.ts` — Electron main process entry
- `src/preload/index.ts` — preload script
- `src/renderer/` — React app entry
- `tailwind.config.js`, `postcss.config.js`

## Step 2: Configuration & Manifest Parsing

Build the config layer in the main process:

1. **Types** — define TypeScript interfaces for central config, project manifest, components, dependencies
2. **Central config loader** — reads `~/.config/service-starter/config.yml`, creates default if missing
3. **Manifest parser** — reads `.service-starter.yml` from a project directory, validates structure
4. **Config merger** — applies central overrides on top of per-project manifests
5. **Env var resolver** — expands `${VAR}` references against `process.env`, flags missing vars

**Files to create:**
- `src/main/config/types.ts` — all TypeScript interfaces
- `src/main/config/central-config.ts` — load/save central config
- `src/main/config/manifest-parser.ts` — parse and validate project manifests
- `src/main/config/config-merger.ts` — merge central overrides into manifests
- `src/main/config/env-resolver.ts` — resolve `${VAR}` references

**Tests:**
- Unit tests for manifest parsing (valid, invalid, partial manifests)
- Unit tests for config merging (overrides applied correctly)
- Unit tests for env var resolution (present, missing, nested)

## Step 3: Project Auto-Discovery

Implement the project scanner that watches configured directories:

1. **Directory scanner** — scans direct children of each scan directory for `.service-starter.yml`
2. **File watcher** — uses `chokidar` to watch for manifest add/remove/modify events
3. **Project registry** — in-memory store of all discovered projects and their parsed configs
4. **Fallback re-scan** — periodic full re-scan on configurable interval

**Files to create:**
- `src/main/discovery/project-scanner.ts` — scan directories for manifests
- `src/main/discovery/file-watcher.ts` — chokidar-based watcher
- `src/main/discovery/project-registry.ts` — in-memory project store with event emitter

**Tests:**
- Integration tests: add/remove manifest files, verify registry updates

## Step 4: Port Monitoring & Conflict Detection

Implement port scanning and conflict logic:

1. **Port scanner** — runs `lsof -iTCP -sTCP:LISTEN -P -n` on interval, parses output into `{ port, pid, process }` entries
2. **Port matcher** — cross-references active ports against component manifests to determine ownership
3. **Conflict detector** — identifies static conflicts (two manifests claim same port) and runtime conflicts (port occupied by unexpected process)
4. **Monitor orchestrator** — ties scanner + matcher + detector together, emits state change events

**Files to create:**
- `src/main/monitoring/port-scanner.ts` — execute lsof, parse output
- `src/main/monitoring/port-matcher.ts` — match ports to components
- `src/main/monitoring/conflict-detector.ts` — detect and categorize conflicts
- `src/main/monitoring/monitor.ts` — orchestrator with event emitter

**Tests:**
- Unit tests for lsof output parsing
- Unit tests for conflict detection (static, runtime, no conflict)

## Step 5: Dependency Health Checks

Implement dependency monitoring:

1. **Docker checker** — uses `dockerode` to check if named containers are running
2. **Service checker** — executes shell `check` commands, interprets exit codes
3. **API checker** — executes check commands + validates env vars are present
4. **Project checker** — checks if referenced project's components have active ports
5. **Health aggregator** — runs all checks on interval, produces per-dependency status

**Files to create:**
- `src/main/dependencies/docker-checker.ts`
- `src/main/dependencies/service-checker.ts`
- `src/main/dependencies/api-checker.ts`
- `src/main/dependencies/project-checker.ts`
- `src/main/dependencies/health-aggregator.ts`

**Tests:**
- Unit tests for each checker (mocked Docker API, mocked shell commands)

## Step 6: IPC Bridge & State Management

Connect main process modules to the renderer:

1. **IPC channels** — define typed channels for all data flows (projects list, port status, dependency health, quick actions)
2. **Preload API** — expose typed API via `contextBridge`
3. **State synchronizer** — main process pushes state updates to renderer on change
4. **React state** — `useEffect` listeners for IPC events, React context for global app state

**Files to create/modify:**
- `src/main/ipc/channels.ts` — channel name constants and payload types
- `src/main/ipc/handlers.ts` — register all IPC handlers
- `src/preload/index.ts` — typed `contextBridge` API
- `src/renderer/src/context/AppContext.tsx` — React context for app state
- `src/renderer/src/hooks/useServiceState.ts` — hook for consuming state

## Step 7: System Tray Implementation

Build the tray icon and dropdown:

1. **Tray manager** — creates tray icon, manages icon state (grey/green/orange)
2. **Tray icon assets** — 3 icon PNGs (grey, green, orange) at appropriate sizes for macOS menu bar
3. **Context menu builder** — dynamically builds the right-click menu
4. **Tray window** — a small frameless BrowserWindow positioned below the tray icon for the dropdown (left-click)
5. **Quick actions** — handlers for "Open in Terminal", "Open in Editor", "Kill process on port"

**Files to create/modify:**
- `src/main/tray/tray-manager.ts` — tray lifecycle and icon state
- `src/main/tray/tray-window.ts` — dropdown BrowserWindow management
- `src/main/tray/quick-actions.ts` — terminal/editor/kill handlers
- `resources/icons/` — tray icon assets (grey.png, green.png, orange.png)
- `src/renderer/src/components/TrayDropdown.tsx` — React component for dropdown UI

## Step 8: Tray Dropdown UI

Build the React UI for the tray dropdown:

1. **TrayDropdown** — main container component
2. **ProjectGroup** — collapsible project with component list
3. **ComponentRow** — shows component name, port, status indicator, hover actions
4. **PortSummary** — footer showing ports in use and conflict warnings
5. **StatusBadge** — reusable status indicator (✅ ⚠️ ❌)

**Files to create:**
- `src/renderer/src/components/TrayDropdown.tsx`
- `src/renderer/src/components/ProjectGroup.tsx`
- `src/renderer/src/components/ComponentRow.tsx`
- `src/renderer/src/components/PortSummary.tsx`
- `src/renderer/src/components/StatusBadge.tsx`

## Step 9: Dashboard Window

Build the full dashboard opened from the tray:

1. **Dashboard layout** — tabbed interface (Projects, Port Map, Dependencies, Settings)
2. **Projects tab** — expandable project cards with component details and quick actions
3. **Port Map tab** — table of all declared ports with ownership and status
4. **Dependencies tab** — grouped view of all external dependencies with health status
5. **Settings tab** — forms for scan directories, intervals, editor/terminal preferences

**Files to create:**
- `src/renderer/src/components/dashboard/DashboardWindow.tsx`
- `src/renderer/src/components/dashboard/ProjectsTab.tsx`
- `src/renderer/src/components/dashboard/PortMapTab.tsx`
- `src/renderer/src/components/dashboard/DependenciesTab.tsx`
- `src/renderer/src/components/dashboard/SettingsTab.tsx`

## Step 10: Integration & Polish

1. Wire up the main process orchestrator — starts all scanners/watchers on app ready
2. Electron app lifecycle — hide dock icon (tray-only), handle quit properly
3. First-run experience — create default central config if missing
4. Error handling — graceful handling of missing Docker, failed lsof, etc.
5. End-to-end manual testing per the verification checklist in the spec

**Files to modify:**
- `src/main/index.ts` — app lifecycle, orchestrator startup
- `src/main/tray/tray-manager.ts` — wire real state into icon updates

## Verification

1. `npm run dev` — app launches, tray icon appears (grey)
2. Create a `.service-starter.yml` in `~/work/service-starter/` — appears in dropdown
3. Run `python3 -m http.server 3000` — component status updates to ✅
4. Run another `python3 -m http.server 3000` attempt — conflict warning appears, tray turns orange
5. Remove the manifest — project disappears from dropdown
6. Quick actions: "Open in Terminal" opens configured terminal, "Open in Editor" opens configured editor
7. Docker dependency: start/stop a container, verify status updates
8. `npm test` — all unit tests pass
