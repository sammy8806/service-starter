# Overview "Patchbay" redesign

Status: approved design, ready for implementation planning
Date: 2026-07-15
Scope: two parts —
1. **Overview UI** — the patchbay redesign of the dashboard's Overview page
   (`OverviewDetail.tsx`).
2. **Port templating** — a spawn-time mechanism that injects a component's
   resolved (override-aware) port into the process it starts, so that
   reassigning a port actually moves the bound port instead of only changing
   what service-starter displays. Without part 2, Reassign is cosmetic.

These can be sequenced as two implementation plans; part 1 delivers value
(the held/blocked clarity) even before part 2 lands.

## Problem

The current Overview stacks four unrelated blocks: a row of four KPI tiles,
a Docker table, a "Port Conflicts" list, and a flat "Port Map" table. It has
three defects:

1. **The same conflict is rendered three times** — once in the "Conflicts" KPI
   tile, once in the Port Conflicts section, and again as every `conflict` row
   in the Port Map. They are the same data sorted the same way.
2. **The port map is mostly noise** — most rows read `free / —`. The signal
   (contested ports) is diluted by rows that carry no information.
3. **A KPI like "6/12 ports active" is not actionable** — nobody makes a
   decision from that number. The tiles look like a metrics dashboard for a
   product this isn't: a single-developer control panel for ~6 local repos
   fighting over a handful of localhost ports.

The app's actual subject is **contention for a scarce resource (ports)**. The
redesign makes the port the organizing spine so that subject becomes the visual
subject — and so the duplication becomes structurally impossible rather than
merely tidied.

## Design language: "Patchbay", Skin A (refined dark)

One vertical list, **sorted by port number**, one row per port. State is carried
by a 2px left accent bar and the port-number color — no badge-pills. Proportional
type, hairline separators, matching the existing Settings/tray chrome. Two
sections: **Ports** then **Containers**.

### Row states

Each Ports row is keyed by port number. Its appearance depends on how many
components claim that port and their runtime status:

- **Idle** (one claimant, not running): grey dot, `project / component` name,
  label right-aligned, a `Run` button that appears on hover.
- **Running** (one claimant, running): green left bar, green port number,
  green dot with glow, `up 12m · pid 48213`, a `Stop` button.
- **Contested** (2+ claimants, none running): amber left bar, amber port
  number, the row **forks** into one line per claimant, each with its label.
  A persistent `Reassign` button.
- **Held & blocked** (2+ claimants, one running): the row that justifies the
  design. Left bar is a green→amber gradient. The holding claimant shows green
  (`holding · up 46m · pid …`); each other claimant is dimmed and labelled
  `blocked — can't start while <holder> holds it`. A `Reassign` button.

The **Containers** section lists Docker containers below the ports, using the
same row grammar: running (green ▲, `Stop`), exited (red ▼, `Start`), and
absent/declared-but-not-created (dimmed ·, `Create` — or no action if create
isn't wired). Each container shows its image and, where known, `usedBy`.

A small filter control in the header toggles All / Contested / Running (client
side, same spirit as the existing port filter input).

## Data derivation

Row and container rendering comes from the existing `AppStateView`
(`src/main/config/types.ts`). Reassign validation and mutation is deliberately
owned by a new main-process IPC operation rather than inferred from renderer
state:

- **Rows**: flatten every `(project, component, port)` into entries, then group
  by `port.port`. A port with one entry is idle/running per that component's
  `ComponentState.status`; a port with 2+ entries is contested.
- **Holder vs blocked**: determine the holder from the active process bound to
  this specific port, not merely from component-level `status`. Correlate the
  port's active pid with the managed-process record when possible. A matching
  managed component is the holder; otherwise render an external/unmanaged
  holder using `PortConflict.activeProcess` / `activePid`. If ownership cannot
  be established, say so rather than assigning the holder heuristically.
- **Containers**: `state.docker.containers` (running/exited) and
  `state.docker.missing` (absent), each already carrying `usedBy`.
- This replaces `buildPortRows` + `computeKpis`; the KPI tiles and the separate
  conflicts section are deleted. A single one-line summary in the header
  ("12 services · 2 running · 3 contested · 1 container up") carries the counts
  that the tiles used to.

## Port templating (part 2 — what makes Reassign real)

### The problem this solves

Today the manifest port is **descriptive, not prescriptive**. `startComponent`
(`process-manager.ts`) spawns `startCommand` split on whitespace, with env
`{ ...process.env, ...comp.env }`. `declaredPorts` is passed only for
conflict-detection (`process-manager.ts:246`) and is never injected. The spawn
path resolves nothing — `resolveEnvVars` runs only for the Env-tab display
(`index.ts:390`). So the real bound port is whatever the component's own tooling
decides (Vite config, `server.port`, uvicorn `--port`), and writing a port
override changes only service-starter's model. A Reassign built on the override
alone would turn the row green while the real conflict persisted — a false green.

### The mechanism (chosen approach: template the startCommand)

Introduce a `${port}` placeholder that the manifest author wires into the command
and/or env, tool-agnostically:

```yaml
startCommand: "vite --port ${port}"          # or
startCommand: "uvicorn app:app --port ${port}"
startCommand: "./mvnw spring-boot:run -Dspring-boot.run.arguments=--server.port=${port}"
env:
  PORT: "${port}"
```

- Syntax: `${port}` resolves to the component's **first declared port**.
  `${port.<label>}` resolves a specific port by its declaration label, for
  multi-port components. Port labels must be non-empty and unique within a
  component because Reassign and labelled templates use the label as the stable
  declaration identity.
- Resolution happens **at spawn**, on both `startCommand` and `env` values,
  against the component's *resolved* ports (which already have overrides applied
  by `mergeConfig`). This closes the loop: override → `mergeConfig` → resolved
  `comp.ports` → `${port}` substitution → real bound port.
- Extend `resolveEnvVars` (or a sibling) to take a context map so `${port}` /
  `${port.<label>}` bindings resolve alongside `${ENV_VAR}`. Apply the same
  substitution to `startCommand` before splitting it in the process manager.
- Port placeholders fail closed: an unknown/duplicate label or unresolved port
  placeholder prevents the component from starting and produces an actionable
  error. A literal unresolved placeholder must never reach the child process.
- **Latent gap noted, not owned here:** the spawn path currently doesn't run
  `resolveEnvVars` on env at all, so `${ENV_VAR}` in env values reaches the
  child literally. Folding port context into the spawn-time resolver is a natural
  moment to fix this, but if it risks scope creep it can be a follow-up — the
  port work only strictly needs `${port}` substitution.

## Reassign (inline picker — part 1 UI, made honest by part 2)

Chosen behaviour: **small inline picker**, expanding the contested/held row.

1. Click `Reassign` → the row expands: "Which one moves off :5173?" with a
   radio list of the port's declared claimants, a port input prefilled with the
   **next available candidate**, and Apply / Cancel. An external process holding
   the port is shown as the holder but is not selectable: Reassign moves one of
   service-starter's declarations, not an arbitrary external process.
2. "Next available candidate" is the lowest valid port greater than the current
   port that is absent from the renderer's declared/observed set. This is only a
   suggestion: the main process rescans and validates the destination on Apply
   because the renderer's observation may be incomplete or stale.
3. Apply calls a dedicated main-process operation:
   `reassignPort(projectName, componentName, portLabel, fromPort, newPort)`.
   Main verifies that the project, component, and uniquely labelled declaration
   still resolve to `fromPort`; that `newPort` is a valid integer in 1–65535,
   differs from `fromPort`, is not duplicated elsewhere in that component, and
   is not currently declared or bound; and that the selected declaration is
   actually wired into `startCommand` or `env` via `${port}` (when it is the
   first declaration) or `${port.<label>}`.
4. Main builds the component's **complete resolved port list**, changes only the
   selected declaration, and writes that complete list to
   `overrides[project].components[component].ports`. This preserves every sibling
   port despite `mergeConfig` replacing the entire ports array. The project
   manifest remains untouched.
5. A claimant currently identified as holding the port cannot be reassigned in
   this iteration. A managed holder is disabled with "Stop before reassigning";
   an external/unmanaged holder is not selectable and explains that it must be
   stopped outside the app. This avoids changing the declaration while the old
   process remains bound. A different, non-running blocked claimant remains
   selectable.
6. Templating validation is a hard guard, not a renderer-only warning. If the
   selected declaration is not referenced, main rejects the operation without
   writing config. The picker displays the returned actionable error and links
   to the templating docs. This validation requires access to resolved manifest
   data and therefore cannot be implemented from `AppStateView` or `getConfig`.
7. On success, main saves the central config, updates the project registry, and
   triggers/publishes fresh state. The picker closes only after success and notes
   "saved as an override, manifest untouched". Validation or persistence failure
   leaves the picker open and the previous configuration intact.

The operation returns a typed result suitable for inline errors, for example
`{ ok: true }` or `{ ok: false, code, message, suggestedPort? }`. Expected error
codes include stale declaration, invalid/occupied destination, missing or
ambiguous template, active holder, and persistence failure.

`Create` on an absent container is out of scope unless a create path already
exists; if not, that row shows no action button.

## Component structure

Break `OverviewDetail` into focused pieces (each testable in isolation):

- `OverviewDetail.tsx` — data derivation + section assembly + the empty state.
- `buildPatchbayRows(state)` (util, unit-tested) — produces the grouped,
  sorted row model including holder/blocked resolution and next-candidate
  helper. Replaces `buildPortRows` and absorbs what `computeKpis` summarised.
- `PortRow.tsx` — renders one port row across all four states; owns the
  reassign picker expansion and its local state; delegates all authoritative
  validation and mutation to `reassignPort`.
- `ContainerRow.tsx` — renders one container row (may reuse/rename the existing
  `DockerContainersSection` internals rather than duplicate them).
- `PatchbayHeader.tsx` — title, one-line summary, All/Contested/Running filter.

Existing `StatusChip` / `KpiCard` / `Section` UI helpers that are no longer used
by Overview are left in place only if other views consume them; otherwise removed.

## Testing

- `buildPatchbayRows`: idle/running/contested/held-blocked classification;
  grouping and sort order; per-port holder correlation; unknown/external holder;
  multi-port components; next-candidate selection.
- `PortRow`: renders each state; opens the picker; Apply calls the Reassign
  operation with the selected declaration identity; an active holder is
  disabled; external-holder explanation; inline success/error behavior; Cancel
  closes without writing.
- Update/replace `OverviewDetail.test.tsx` for the new structure and empty state.
- Update the screenshot fixtures (`src/renderer/src/screenshots/fixtures.ts`) so
  the preview covers a held-and-blocked port.
- **Port templating**: `${port}` and `${port.<label>}` substitution in
  `startCommand` and env values; first-port default; unknown label; a command
  with no placeholder passes through unchanged; multi-port component resolves
  each label correctly; duplicate/empty labels are rejected; unresolved port
  placeholders prevent spawn. An integration-level check that a reassigned
  override flows through `mergeConfig` into the resolved command string.
- **Reassign operation**: preserves sibling ports; rejects stale `fromPort`,
  invalid/same/declared/bound destinations, missing or ambiguous templates, and
  active holders; distinguishes external processes; handles a port
  becoming occupied between suggestion and Apply; does not mutate config on any
  failure; reports persistence failure; refreshes state after success.

## Out of scope

- Restyling the tray, Settings, or project/component detail views (Skin A here
  matches existing chrome, but a full app-wide restyle is separate work).
- Creating absent Docker containers, unless that path already exists.
- Persisting run history ("last run yesterday") — not used by this design.
