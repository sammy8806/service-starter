# Authoring & Updating .service-starter.yml Manifests

Workflow reference for creating or updating a `.service-starter.yml` in a target repo. Worked examples live in [manifest-examples.md](manifest-examples.md); a copy-paste generation prompt in [generate-service-starter-manifest.md](generate-service-starter-manifest.md). Parser ground truth: `src/main/config/manifest-parser.ts` and `types.ts`.

## Critical facts

- **Filename is exactly `.service-starter.yml`** at the repo root. `.yaml` is silently ignored (parser matches the literal string).
- **Discovery scans only direct children** of `scanDirectories` from `~/.config/service-starter/config.yml` (default `~/work`). Nested repos are not found.
- Changes are picked up live by a file watcher — no restart needed after writing the file.
- `startCommand` is only pre-filled in the terminal, never auto-run.
- **Never invent** ports, commands, containers, dependencies, or env vars. If evidence is weak, omit the field and call out the gap.

## Workflow: create a manifest for a repo

1. **Gather evidence.** Inspect, in order:
   - Workspace/package files: `package.json` (scripts!), `pnpm-workspace.yaml`, `turbo.json`, `nx.json`; Gradle/Maven files; `Makefile`
   - Compose files: `compose.yaml`, `compose.yml`, `docker-compose.yml`, `docker-compose.yaml`
   - README / setup docs for dev commands and ports
   - App configs for ports: Vite/Next/CRA config, `application.yml` (Spring), Storybook, docs sites, debug ports (e.g. Spring 5005)
2. **Identify components.** One component per *independently runnable* dev app: frontend, backend, worker, docs/storybook. Not per package — per thing you'd start.
3. **Fill fields minimally** (omission beats guessing):
   - `workDir` only if the component doesn't run from repo root
   - `codeDir` only if it's a meaningfully better "Open in Editor" target than workDir
   - `startCommand` only when an established local-dev command exists in scripts/docs
   - `ports` only those actually expected in local dev; include configured debug ports
   - `env` with `${VAR}` only for values that must come from the shell environment
4. **Add dependencies.** Component-level when specific to one component; project-level when they apply to the whole repo (e.g. `docker info`). For Compose-defined containers use `composeService` (Compose stays source of truth for name/image); `container` only for standalone/externally managed ones. `type: project` references another repo's manifest `name` — check that manifest exists.
5. **Write `.service-starter.yml`** at the repo root (mind the `.yml`!).
6. **Report** the YAML plus a short Evidence section (which file justified each command/port/dep) and Assumptions/Gaps.

## Workflow: update an existing manifest

- Read the current manifest first; preserve fields that still have evidence.
- Diff reality vs. manifest: new/removed run targets in scripts, changed ports in configs, Compose services added/renamed, dead containers.
- Don't churn cosmetics — change only what the evidence changed.
- If the project was renamed, remember `name` is the cross-project reference key: grep sibling repos' manifests for `type: project` references to the old name.

## Shape

```yaml
name: project-name            # optional; falls back to directory name
components:                   # required; one per independently runnable app
  api:
    workDir: ./packages/api      # optional, default ./
    codeDir: ./packages/api/src  # optional editor target, default workDir
    editor: code                 # optional per-component editor key
    startCommand: npm run dev
    ports:                       # {port, label}; label defaults to "Port N"
      - port: 3000
        label: API
    env:                         # ${VAR} resolved from shell env
      DATABASE_URL: ${DATABASE_URL}
    dependencies:
      - type: docker
        composeService: postgres # composeFile: compose.dev.yml for non-default
dependencies:                 # project-level
  - type: project
    name: other-project
```

## Dependency types

| Type | Required fields | Health check |
|------|----------------|--------------|
| `docker` | `composeService` **or** `container` (+optional `image`, `composeFile`) | Container state via Docker API |
| `service` | `name`, `check` | Shell command; exit 0 = healthy |
| `api` | `name`, `check` (+optional `envRequired: [VARS]`) | Shell command + env vars set |
| `project` | `name` | Referenced project has active ports |

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Named the file `.service-starter.yaml` | Rename to `.yml` — the `.yaml` variant is never read |
| Project nested deeper than one level under a scan dir | Add its parent to `scanDirectories`, or symlink it under one |
| One component per package in a monorepo | Only packages you actually start independently get components |
| Hardcoding container names duplicated from Compose | Use `composeService` |
| Guessed ports/commands "to be complete" | Omit and list under Assumptions/Gaps |
| `type: project` name doesn't match target's `name` field | Open the other repo's manifest and copy its `name` |
