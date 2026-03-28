# Service Starter — Design Spec

## Context

Working with 80+ projects across multiple directories (starting with `~/work/`) means constantly juggling which services are running, which ports they occupy, whether their dependencies are up, and whether anything conflicts. There's no unified view of this — you check manually, hit port conflicts by surprise, and forget which Docker containers a project needs.

Service Starter is a system tray application that auto-discovers projects, shows what's running at a glance, warns about port conflicts, and tracks dependency health — all from the menu bar.

## Architecture

**Monolithic Electron app.** Single process with clean internal module separation. All logic (scanning, monitoring, config, UI) lives in one app. This is the simplest path to a working product; modules can be extracted into a daemon later if CLI/headless access is ever needed.

| Layer | Technology |
|-------|-----------|
| App shell | Electron (main + renderer) |
| UI framework | React + TypeScript |
| Styling | Tailwind CSS |
| Tray/native | Electron Tray API |
| Port scanning | `lsof -iTCP -sTCP:LISTEN` via child_process |
| Docker monitoring | Docker Engine API via `dockerode` |
| File watching | `chokidar` |
| Config parsing | `js-yaml` |
| IPC | Electron IPC (main ↔ renderer) |
| Build/package | `electron-builder` |

## Configuration

### Layered config model

Two layers, with central config overriding per-project manifests.

### Central config — `~/.config/service-starter/config.yml`

```yaml
scanDirectories:
  - ~/work
  # - ~/personal/projects  # add more later

scanIntervalMs: 5000       # how often to re-scan for new projects
portScanIntervalMs: 3000   # how often to check port usage
editor: code               # default editor for "open in editor" action
terminal: default           # terminal app for "open in terminal"

overrides:
  bandai-mobile:
    components:
      backend:
        ports:
          - port: 9080
            label: API (override)
```

### Per-project manifest — `<project>/.service-starter.yml`

```yaml
name: bandai-mobile

components:
  frontend:
    workDir: ./frontend
    codeDir: ./frontend/src
    startCommand: npm start
    ports:
      - port: 3000
        label: Dev Server
    env:
      VITE_API_URL: http://localhost:8080
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    dependencies:
      - type: docker
        container: redis-dev

  backend:
    workDir: ./backend
    codeDir: ./backend/src
    startCommand: ./gradlew bootRun
    ports:
      - port: 8080
        label: API
      - port: 5005
        label: Debug Port
    env:
      DB_URL: jdbc:postgresql://localhost:5432/bandai
      SPRING_PROFILES_ACTIVE: dev
    dependencies:
      - type: docker
        container: postgres-dev
        image: postgres:16
      - type: service
        name: tailscale
        check: tailscale status
      - type: api
        name: anthropic
        check: curl -sf https://api.anthropic.com/v1/messages -o /dev/null
        envRequired:
          - ANTHROPIC_API_KEY

  worker:
    workDir: ./services/worker
    codeDir: ./services/worker/src
    startCommand: npm run worker
    ports:
      - port: 9090
        label: Worker Health
    env:
      REDIS_URL: redis://localhost:6379

dependencies:
  - type: project
    name: bandai-api
```

### Config fields

**Component fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `workDir` | No | Working directory for the component (relative to project root). Default: project root. |
| `codeDir` | No | Source code directory for "open in editor" action. Default: same as `workDir`. |
| `startCommand` | No | Shell command to start the component. Used by the "Open in Terminal" quick action to pre-fill the command — the app does not manage processes directly. |
| `ports` | No | List of `{ port, label }` objects. |
| `env` | No | Key-value pairs. `${VAR}` syntax references shell environment variables. Used for validation only — the dashboard warns if referenced env vars are missing from the shell environment. The app does not inject these into processes. |
| `dependencies` | No | Component-level dependencies (merged with project-level). |

**Dependency types:**

| Type | Fields | Check method |
|------|--------|-------------|
| `docker` | `container`, `image` (optional) | Docker Engine API — is container running? |
| `service` | `name`, `check` | Execute shell command — exit code 0 = healthy |
| `api` | `name`, `check`, `envRequired` (optional) | Execute check command + verify env vars are set |
| `project` | `name` | Is the referenced project's component(s) running? |

## System Tray

### Tray icon states

- **Grey** — idle, no projects running
- **Green** — projects running, no issues
- **Orange** — warning: port conflict or missing dependency

### Tray dropdown (left-click)

Compact view showing all discovered projects grouped by status:

```
┌─────────────────────────────────┐
│ Service Starter                 │
├─────────────────────────────────┤
│ ● bandai-mobile                 │
│   ├ frontend    :3000  ✅       │
│   ├ backend     :8080  ✅       │
│   └ worker      :9090  ⚠️ env  │
│                                 │
│ ● diy-finance                   │
│   └ backend     :8080  ⚠️ port │
│                                 │
│ ○ fmh-buero  (stopped)         │
├─────────────────────────────────┤
│ Ports in use: 3000, 8080, 9090  │
│ ⚠ Port 8080 conflict (2 proj)  │
├─────────────────────────────────┤
│ 🔧 Settings   📋 Dashboard     │
└─────────────────────────────────┘
```

- **●** = has running components, **○** = all stopped
- Status indicators per component: ✅ healthy, ⚠️ issue (env/port/dep), ❌ dependency down

### Quick actions (per component, on hover/click)

- **Open in Terminal** — opens `workDir` in configured terminal
- **Open in Editor** — opens `codeDir` in configured editor
- **Kill process on port** — kills the process occupying the component's port

### Context menu (right-click tray icon)

- Settings
- Open Dashboard
- Quit

## Dashboard Window

Full window opened from the tray, with these views:

### Projects view
- All discovered projects with their components
- Status of each component (running/stopped, port status, dependency health)
- Expand/collapse per project
- Quick actions available per component

### Port map
- Table showing all declared ports across all projects
- Which component owns each port
- Current status (free / in use / conflict)
- Highlights conflicts

### Dependencies overview
- All external dependencies across projects
- Docker containers: running/stopped
- Services: healthy/unreachable
- APIs: reachable/unreachable, env vars present/missing

### Settings
- Manage scan directories
- Set scan intervals
- Configure editor and terminal preferences
- Create/edit project manifests

## Port Monitoring & Conflict Detection

### Scanner

Runs in the Electron main process on a configurable interval (default 3s):

1. Execute `lsof -iTCP -sTCP:LISTEN -P -n` to get all listening ports with PIDs
2. Cross-reference active ports against all component manifests
3. Categorize:
   - **Managed** — port belongs to a known component
   - **Unmanaged** — port is in use but not declared in any manifest
   - **Conflict** — two or more components declare the same port

### Conflict types

1. **Static conflict** — two component manifests declare the same port. Detected during manifest scanning, always visible as a warning regardless of whether anything is running.
2. **Runtime conflict** — a port is in use by a process that doesn't match the declaring component. Detected during port scanning.

### Warning behavior

- Tray icon turns orange when any conflict or dependency issue exists
- Conflicting components are highlighted in both the dropdown and dashboard
- Confirmation dialog before triggering any quick action that would cause a conflict

## Auto-Discovery

### Scanner behavior

- Watches configured directories for direct child subdirectories (non-recursive: `~/work/*`, not `~/work/**/*`)
- Looks for `.service-starter.yml` in each subdirectory
- Uses `chokidar` file watcher for real-time detection of added/removed/modified manifests
- Full re-scan on configurable interval as a fallback

### Unconfigured projects

- Directories without a `.service-starter.yml` appear as "unconfigured" in the dashboard
- Dashboard offers an action to create a starter manifest for unconfigured projects

## Verification

### Manual testing

1. Start the Electron app — tray icon should appear (grey)
2. Place a `.service-starter.yml` in a project under `~/work/` — it should appear in the dropdown within 5 seconds
3. Start a process on a declared port — component status should change to ✅
4. Start a second process on the same port — tray should turn orange, conflict warning shown
5. Remove the manifest file — project should disappear from the dropdown
6. Quick actions: "Open in Terminal" and "Open in Editor" should open the correct directories

### Automated testing

- Unit tests for config parsing and merging (central + manifest + overrides)
- Unit tests for port conflict detection logic
- Unit tests for dependency health check logic
- Integration tests for file watcher (add/remove/modify manifests)
