# Overview "Patchbay" redesign

Status: approved design, ready for implementation planning
Date: 2026-07-15
Scope: the Overview page of the dashboard window (`OverviewDetail.tsx`) plus a
small central-config write path for reassigning ports.

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

All from the existing `AppStateView` (`src/main/config/types.ts`), no new
main-process state:

- **Rows**: flatten every `(project, component, port)` into entries, then group
  by `port.port`. A port with one entry is idle/running per that component's
  `ComponentState.status`; a port with 2+ entries is contested.
- **Holder vs blocked**: within a contested port, the claimant whose
  `ComponentState.status === 'running'` is the holder; the rest are blocked.
  `PortConflict.activeProcess` / `activePid` (keyed by port in `state.conflicts`)
  provide the pid/process label for the holder when the holder is an external
  (unmanaged) process.
- **Containers**: `state.docker.containers` (running/exited) and
  `state.docker.missing` (absent), each already carrying `usedBy`.
- This replaces `buildPortRows` + `computeKpis`; the KPI tiles and the separate
  conflicts section are deleted. A single one-line summary in the header
  ("12 services · 2 running · 3 contested · 1 container up") carries the counts
  that the tiles used to.

## Reassign (inline picker)

Chosen behaviour: **small inline picker**, expanding the contested/held row.

1. Click `Reassign` → the row expands to show: "Which one moves off :5173?"
   with a radio list of the port's claimants (the currently-declared owner is
   selectable but not forced), a port input prefilled with the **next free
   port**, and Apply / Cancel.
2. "Next free port" = lowest port ≥ the current one not present in the set of
   all declared/observed ports.
3. Apply writes a central-config override, **not** the project manifest:
   `overrides[project].components[component].ports = [{ port: newPort, label }]`.
   This uses the existing `getConfig` → mutate → `saveConfig` IPC path;
   `mergeConfig` already applies `overrides[...].components[...].ports`, so the
   registry re-resolves and the row heals on the next state push.
4. The picker notes "saved as an override, manifest untouched" so the user
   understands where the change lives.

No new backend feature is required for reassign beyond the config write — the
override plumbing already exists (`ComponentOverride.ports`, `mergeConfig`).
`Create` on an absent container is out of scope for this change unless a create
path already exists; if not, that row shows no action button.

## Component structure

Break `OverviewDetail` into focused pieces (each testable in isolation):

- `OverviewDetail.tsx` — data derivation + section assembly + the empty state.
- `buildPatchbayRows(state)` (util, unit-tested) — produces the grouped,
  sorted row model including holder/blocked resolution and next-free-port
  helper. Replaces `buildPortRows` and absorbs what `computeKpis` summarised.
- `PortRow.tsx` — renders one port row across all four states; owns the
  reassign picker expansion and its local state.
- `ContainerRow.tsx` — renders one container row (may reuse/rename the existing
  `DockerContainersSection` internals rather than duplicate them).
- `PatchbayHeader.tsx` — title, one-line summary, All/Contested/Running filter.

Existing `StatusChip` / `KpiCard` / `Section` UI helpers that are no longer used
by Overview are left in place only if other views consume them; otherwise removed.

## Testing

- `buildPatchbayRows`: idle/running/contested/held-blocked classification;
  grouping and sort order; multi-port components; next-free-port selection.
- `PortRow`: renders each state; opens the picker; Apply calls the config-write
  callback with the right override shape; Cancel closes without writing.
- Update/replace `OverviewDetail.test.tsx` for the new structure and empty state.
- Update the screenshot fixtures (`src/renderer/src/screenshots/fixtures.ts`) so
  the preview covers a held-and-blocked port.

## Out of scope

- Restyling the tray, Settings, or project/component detail views (Skin A here
  matches existing chrome, but a full app-wide restyle is separate work).
- Creating absent Docker containers, unless that path already exists.
- Persisting run history ("last run yesterday") — not used by this design.
