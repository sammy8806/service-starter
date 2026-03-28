# Start/Stop Service Feature

## Summary

Add the ability to start and stop service components from within Service Starter. Currently the app only monitors — this makes it a control plane too.

## Decisions

- **Scope**: Start/stop at both project level (all components) and individual component level
- **Process lifecycle**: Detached — processes survive Service Starter restarts
- **Logs**: Colocated in `.service-starter/logs/<componentName>.log` per project directory, overwritten on each start
- **External processes**: Visual distinction between managed (started by Service Starter) and external (detected via port scan). Stop for managed, kill-port for external.
- **Dependency ordering**: None — all components start in parallel
- **Architecture**: ProcessManager + LogStreamer (Approach C)

## Architecture

### ProcessManager (`src/main/process/process-manager.ts`)

Spawns detached processes, tracks PIDs, persists state, handles stop and reconnection.

**State per process** (keyed by `projectName:componentName`):
- pid, startedAt, startCommand, workDir, logFile, status (running | stopped | crashed)

**PID persistence**: `.service-starter/state.json` in each project directory. On app launch, checks if PIDs are still alive via `process.kill(pid, 0)`. Dead PIDs marked as crashed/stopped.

**Spawning**:
- `child_process.spawn` with `detached: true`, stdio redirected to log file
- `child.unref()` so Node doesn't hold the child
- stdout + stderr merged to `.service-starter/logs/<componentName>.log`
- State file updated immediately after spawn

**Stopping**:
- `SIGTERM` to process group (`-pid` to kill the tree)
- 5-second grace period, then `SIGKILL` if still alive
- State file updated

**Events**: `process-started`, `process-stopped`, `process-crashed` — main orchestrator listens and pushes state.

**Reconnection on launch**: Reads all `.service-starter/state.json` files from known projects, validates PIDs, updates statuses.

### LogStreamer (`src/main/process/log-streamer.ts`)

Streams log file content to the renderer via IPC. Separate from ProcessManager — it only reads files.

**Operations**:
- `getLog(projectName, componentName)`: Read current log file content (for initial load)
- `startTailing(projectName, componentName)`: Watch file for changes, push new lines via IPC
- `stopTailing(projectName, componentName)`: Stop watching

**Implementation**: Uses `fs.watch` or chokidar on the log file. On change, reads new bytes from last known offset and pushes via IPC channel `log:data`.

### Integration Points

**IPC channels** (new):
- `process:start-component` — start a single component
- `process:stop-component` — stop a single component
- `process:start-project` — start all components in a project
- `process:stop-project` — stop all components in a project
- `log:get` — get current log content
- `log:start-tail` — start streaming log updates
- `log:stop-tail` — stop streaming
- `log:data` — main→renderer push of new log lines

**Preload API additions**:
- `startComponent(projectName, componentName)`
- `stopComponent(projectName, componentName)`
- `startProject(projectName)`
- `stopProject(projectName)`
- `getLog(projectName, componentName)`
- `startLogTail(projectName, componentName)`
- `stopLogTail(projectName, componentName)`
- `onLogData(callback)`

**State changes**:
- `AppState` gains process status per component: `'managed-running' | 'external-running' | 'stopped' | 'crashed'`
- Tray dropdown and dashboard show start/stop buttons based on status
- Visual distinction: managed processes show a stop button, external processes show kill-port

### UI Changes

**ComponentRow**: Add start/stop toggle button. Show status badge distinguishing managed vs external.

**Dashboard ProjectsTab**: Add start/stop all buttons per project. Show log viewer panel (streaming log content for selected component).

**TrayDropdown**: Compact start/stop controls per component row.

### File Structure

```
src/main/process/
  process-manager.ts      # Spawn, track, stop, reconnect
  process-manager.test.ts
  log-streamer.ts         # Read and tail log files
  log-streamer.test.ts
  types.ts                # ManagedProcess, ProcessState types
```

Per project directory:
```
.service-starter/
  state.json              # PID tracking / persistence
  logs/
    frontend.log
    backend.log
```
