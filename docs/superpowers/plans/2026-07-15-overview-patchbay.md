# Overview Patchbay + Port Templating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Overview page with a port-keyed "patchbay" view, and make port reassignment actually move the bound port by templating the start command with the resolved port.

**Architecture:** Three layers. (A) A pure `port-template` module resolves `${port}` / `${port.<label>}` against a component's resolved ports; the process manager applies it at spawn so the declared port drives the real bound port. (B) A `reassignPort` main-process operation validates a move and writes a central-config override (preserving sibling ports), exposed over IPC. (C) The renderer derives a grouped, port-sorted row model (`buildPatchbayRows`) and renders it with `PortRow` (incl. the inline reassign picker), `PatchbayHeader`, and the existing Docker section.

**Tech Stack:** Electron + TypeScript, React 18 + Tailwind (renderer), Vitest + @testing-library/react for tests.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-15-overview-patchbay-design.md` — every task's requirements implicitly include it.
- Port placeholders **fail closed**: an unknown/duplicate label or an unresolved `${port}` placeholder must prevent the component from starting; a literal unresolved placeholder must never reach the child process.
- Port labels must be **non-empty and unique within a component** — labels are the stable declaration identity for templating and reassign.
- Reassign is a **main-process operation** returning a typed result `{ ok: true } | { ok: false, code, message, suggestedPort? }`. Renderer never mutates config directly for reassign; it must not write a green/healthy row it cannot back with a real port move.
- Reassign writes to `overrides[project].components[component].ports` as the component's **complete resolved port list** (mergeConfig replaces the whole array). The project manifest is never touched.
- Run all tests with `npx vitest run <file>`; typecheck with `npm run typecheck`. Commit after each task.
- Follow existing house style: named exports, `React.JSX.Element` return types, Tailwind classes matching the existing zinc/amber/emerald palette, Vitest `describe/it/expect`.

---

## File map

**Part A — Port templating (main)**
- Create: `src/main/config/port-template.ts` — pure resolver + label/reference helpers.
- Create: `src/main/config/port-template.test.ts`
- Modify: `src/main/process/process-manager.ts` — apply templating at spawn; accept `ports`.
- Modify: `src/main/process/process-manager.test.ts`
- Modify: `src/main/index.ts` — pass `ports: comp.ports` at both start call sites.

**Part B — Reassign operation + IPC (main/preload)**
- Create: `src/main/config/reassign-port.ts` — `reassignPort(deps, …)`.
- Create: `src/main/config/reassign-port.test.ts`
- Modify: `src/main/ipc/channels.ts` — add `REASSIGN_PORT`.
- Modify: `src/main/ipc/handlers.ts` — add `reassignPort` dep + handler.
- Modify: `src/main/index.ts` — wire the handler dep to a `reassignPort` closure.
- Modify: `src/preload/index.ts` and `src/preload/index.d.ts` — expose `reassignPort`.

**Part C — Patchbay UI (renderer)**
- Create: `src/renderer/src/utils/patchbayRows.ts` — `buildPatchbayRows`, `nextAvailablePort`.
- Create: `src/renderer/src/utils/patchbayRows.test.ts`
- Create: `src/renderer/src/components/dashboard/PatchbayHeader.tsx`
- Create: `src/renderer/src/components/dashboard/PortRow.tsx`
- Create: `src/renderer/src/components/dashboard/PortRow.test.tsx`
- Modify: `src/renderer/src/components/dashboard/OverviewDetail.tsx` — assemble the new view.
- Modify: `src/renderer/src/components/dashboard/OverviewDetail.test.tsx` — rewrite.
- Modify: `src/renderer/src/context/AppContext.tsx` — add `reassignPort` action + `ReassignResult` type.

---

## Task 1: Port template resolver (pure module)

**Files:**
- Create: `src/main/config/port-template.ts`
- Test: `src/main/config/port-template.test.ts`

**Interfaces:**
- Consumes: `PortDeclaration` from `./types` (`{ port: number; label: string }`).
- Produces:
  - `validatePortLabels(ports: PortDeclaration[]): string | undefined`
  - `resolvePortTemplate(text: string, ports: PortDeclaration[]): { resolved: string; error?: string }`
  - `templateReferencesPortLabel(texts: string[], ports: PortDeclaration[], label: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// src/main/config/port-template.test.ts
import { describe, it, expect } from 'vitest'
import {
  validatePortLabels,
  resolvePortTemplate,
  templateReferencesPortLabel
} from './port-template'

const ports = [
  { port: 5173, label: 'frontend' },
  { port: 8000, label: 'api' }
]

describe('port-template', () => {
  describe('validatePortLabels', () => {
    it('accepts non-empty unique labels', () => {
      expect(validatePortLabels(ports)).toBeUndefined()
    })
    it('rejects empty labels', () => {
      expect(validatePortLabels([{ port: 1, label: '' }])).toMatch(/empty label/)
    })
    it('rejects duplicate labels', () => {
      expect(
        validatePortLabels([{ port: 1, label: 'x' }, { port: 2, label: 'x' }])
      ).toMatch(/Duplicate port label: x/)
    })
  })

  describe('resolvePortTemplate', () => {
    it('resolves bare ${port} to the first declared port', () => {
      expect(resolvePortTemplate('vite --port ${port}', ports)).toEqual({
        resolved: 'vite --port 5173'
      })
    })
    it('resolves ${port.<label>} to the matching port', () => {
      expect(resolvePortTemplate('uvicorn --port ${port.api}', ports)).toEqual({
        resolved: 'uvicorn --port 8000'
      })
    })
    it('passes through text without placeholders unchanged', () => {
      expect(resolvePortTemplate('npm run dev', ports)).toEqual({ resolved: 'npm run dev' })
    })
    it('fails closed on an unknown label (placeholder left intact)', () => {
      const r = resolvePortTemplate('x ${port.nope}', ports)
      expect(r.error).toMatch(/Unknown port label: nope/)
      expect(r.resolved).toContain('${port.nope}')
    })
    it('fails closed on ${port} with no declared ports', () => {
      const r = resolvePortTemplate('x ${port}', [])
      expect(r.error).toMatch(/No ports declared/)
    })
    it('surfaces label-validation errors', () => {
      const r = resolvePortTemplate('x ${port}', [{ port: 1, label: '' }])
      expect(r.error).toMatch(/empty label/)
    })
  })

  describe('templateReferencesPortLabel', () => {
    it('true when bare ${port} references the first declaration', () => {
      expect(templateReferencesPortLabel(['vite --port ${port}'], ports, 'frontend')).toBe(true)
    })
    it('false when bare ${port} but label is not the first declaration', () => {
      expect(templateReferencesPortLabel(['vite --port ${port}'], ports, 'api')).toBe(false)
    })
    it('true when ${port.<label>} references that label from env', () => {
      expect(templateReferencesPortLabel(['${port.api}'], ports, 'api')).toBe(true)
    })
    it('false when no placeholder references the label', () => {
      expect(templateReferencesPortLabel(['npm run dev'], ports, 'frontend')).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/config/port-template.test.ts`
Expected: FAIL — "Failed to resolve import './port-template'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/config/port-template.ts
import { PortDeclaration } from './types'

/** Matches ${port} and ${port.<label>}. A fresh RegExp per call avoids shared lastIndex bugs. */
const PATTERN_SOURCE = '\\$\\{port(?:\\.([^}]+))?\\}'

export function validatePortLabels(ports: PortDeclaration[]): string | undefined {
  const seen = new Set<string>()
  for (const p of ports) {
    if (!p.label || p.label.trim() === '') return 'Port declaration has an empty label'
    if (seen.has(p.label)) return `Duplicate port label: ${p.label}`
    seen.add(p.label)
  }
  return undefined
}

export function resolvePortTemplate(
  text: string,
  ports: PortDeclaration[]
): { resolved: string; error?: string } {
  const labelError = validatePortLabels(ports)
  if (labelError) return { resolved: text, error: labelError }

  let error: string | undefined
  const resolved = text.replace(new RegExp(PATTERN_SOURCE, 'g'), (match, label?: string) => {
    if (label === undefined) {
      if (ports.length === 0) {
        error = 'No ports declared for ${port}'
        return match
      }
      return String(ports[0].port)
    }
    const found = ports.find((p) => p.label === label)
    if (!found) {
      error = `Unknown port label: ${label}`
      return match
    }
    return String(found.port)
  })

  return error ? { resolved, error } : { resolved }
}

export function templateReferencesPortLabel(
  texts: string[],
  ports: PortDeclaration[],
  label: string
): boolean {
  const isFirst = ports.length > 0 && ports[0].label === label
  return texts.some((text) => {
    const re = new RegExp(PATTERN_SOURCE, 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const ref = m[1]
      if (ref === undefined && isFirst) return true
      if (ref === label) return true
    }
    return false
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/config/port-template.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/main/config/port-template.ts src/main/config/port-template.test.ts
git commit -m "feat(config): add port template resolver"
```

---

## Task 2: Apply templating at spawn

**Files:**
- Modify: `src/main/process/process-manager.ts:8-16` (options), `:66-99` (spawn body), `:245-260` (assert)
- Modify: `src/main/index.ts:255-260` and `:311-316` (both start call sites)
- Test: `src/main/process/process-manager.test.ts`

**Interfaces:**
- Consumes: `resolvePortTemplate` from `../config/port-template`; `PortDeclaration` from `../config/types`.
- Produces: `StartComponentOptions` gains `ports?: PortDeclaration[]`; when present, `startCommand` and every `env` value are port-resolved before spawn, and `declaredPorts` defaults to `ports.map(p => p.port)`.

- [ ] **Step 1: Write the failing test** (append to `process-manager.test.ts`)

```ts
import { describe, it, expect, vi } from 'vitest'
import { ProcessManager } from './process-manager'
import * as child from 'child_process'

describe('ProcessManager port templating', () => {
  it('substitutes ${port} in the start command before spawning', async () => {
    const spawnSpy = vi.spyOn(child, 'spawn').mockReturnValue({
      pid: 4242,
      unref: () => {}
    } as unknown as child.ChildProcess)
    const pm = new ProcessManager(async () => []) // no active ports

    await pm.startComponent({
      projectName: 'p',
      componentName: 'c',
      startCommand: 'vite --port ${port}',
      workDir: process.cwd(),
      projectDir: process.cwd(),
      ports: [{ port: 5174, label: 'frontend' }],
      env: { PORT: '${port}' }
    })

    const [cmd, args, opts] = spawnSpy.mock.calls[0]
    expect(cmd).toBe('vite')
    expect(args).toEqual(['--port', '5174'])
    expect((opts as { env: Record<string, string> }).env.PORT).toBe('5174')
    spawnSpy.mockRestore()
    await pm.stopComponent('p', 'c')
  })

  it('fails closed when a placeholder cannot be resolved', async () => {
    const spawnSpy = vi.spyOn(child, 'spawn')
    const pm = new ProcessManager(async () => [])
    await expect(
      pm.startComponent({
        projectName: 'p',
        componentName: 'c',
        startCommand: 'x ${port.missing}',
        workDir: process.cwd(),
        projectDir: process.cwd(),
        ports: [{ port: 1, label: 'frontend' }]
      })
    ).rejects.toThrow(/Unknown port label: missing/)
    expect(spawnSpy).not.toHaveBeenCalled()
    spawnSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/process/process-manager.test.ts`
Expected: FAIL — `${port}` reaches spawn literally / no error thrown.

- [ ] **Step 3: Write minimal implementation**

In `src/main/process/process-manager.ts`, add the import and `PortDeclaration`:

```ts
import { ManagedProcess, ProcessStateFile } from './types'
import { PortDeclaration } from '../config/types'
import { resolvePortTemplate } from '../config/port-template'
```

Extend the options interface:

```ts
interface StartComponentOptions {
  projectName: string
  componentName: string
  startCommand: string
  workDir: string
  projectDir: string
  declaredPorts?: number[]
  ports?: PortDeclaration[]
  env?: Record<string, string>
}
```

Replace the command/env section (currently `process-manager.ts:85-99`) with:

```ts
    // Resolve ${port} templates against the component's resolved ports (fail closed)
    const ports = opts.ports ?? []
    const cmdResult = resolvePortTemplate(opts.startCommand, ports)
    if (cmdResult.error) {
      closeSync(logFd)
      throw new Error(
        `Cannot start ${opts.projectName}/${opts.componentName}: ${cmdResult.error}`
      )
    }
    const resolvedEnv: Record<string, string> = {}
    for (const [envKey, envValue] of Object.entries(opts.env ?? {})) {
      const r = resolvePortTemplate(envValue, ports)
      if (r.error) {
        closeSync(logFd)
        throw new Error(
          `Cannot start ${opts.projectName}/${opts.componentName}: ${r.error}`
        )
      }
      resolvedEnv[envKey] = r.resolved
    }

    // Parse resolved command
    const parts = cmdResult.resolved.split(/\s+/)
    const cmd = parts[0]
    const args = parts.slice(1)

    // Merge env
    const env = { ...process.env, ...resolvedEnv }
```

Note: `assertPortsAvailable` runs before the log file is opened, so also make it port-aware. Change its guard (`process-manager.ts:246`) to derive declared ports from `ports` when `declaredPorts` is absent:

```ts
  private async assertPortsAvailable(opts: StartComponentOptions): Promise<void> {
    const declared = opts.declaredPorts ?? opts.ports?.map((p) => p.port) ?? []
    if (!declared.length) return

    const activePorts = await this.portScanner()
    const conflicts = activePorts.filter((active) => declared.includes(active.port))
    if (conflicts.length === 0) return

    const details = conflicts
      .map((conflict) => `:${conflict.port} (${conflict.process} pid ${conflict.pid})`)
      .join(', ')
    throw new Error(
      `Cannot start ${opts.projectName}/${opts.componentName}; port already bound: ${details}`
    )
  }
```

- [ ] **Step 4: Update `index.ts` call sites and run tests**

In `src/main/index.ts`, both start blocks (~`:255` and `:311`) pass `declaredPorts: comp.ports.map((port) => port.port)`. Add `ports: comp.ports` alongside it in each:

```ts
            startCommand: comp.startCommand,
            workDir: comp.workDir ? join(dir, comp.workDir) : dir,
            projectDir: dir,
            declaredPorts: comp.ports.map((port) => port.port),
            ports: comp.ports,
            env: comp.env
```

Run: `npx vitest run src/main/process/process-manager.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/main/process/process-manager.ts src/main/process/process-manager.test.ts src/main/index.ts
git commit -m "feat(process): resolve \${port} templates at spawn"
```

---

## Task 3: `reassignPort` operation

**Files:**
- Create: `src/main/config/reassign-port.ts`
- Test: `src/main/config/reassign-port.test.ts`

**Interfaces:**
- Consumes: `CentralConfig`, `ResolvedProject`, `PortDeclaration` from `./types`; `templateReferencesPortLabel` from `./port-template`.
- Produces:
  - `type ReassignErrorCode = 'project-not-found' | 'component-not-found' | 'declaration-not-found' | 'stale-declaration' | 'invalid-destination' | 'destination-occupied' | 'missing-template' | 'active-holder' | 'persist-failed'`
  - `interface ReassignResult { ok: boolean; code?: ReassignErrorCode; message?: string; suggestedPort?: number }`
  - `interface ReassignDeps { getProjects(): Map<string, ResolvedProject>; getConfig(): CentralConfig; applyConfig(config: CentralConfig): void; isPortActive(port: number): boolean; isManagedRunning(projectName: string, componentName: string): boolean }`
  - `reassignPort(deps: ReassignDeps, projectName: string, componentName: string, portLabel: string, fromPort: number, newPort: number): ReassignResult`

- [ ] **Step 1: Write the failing test**

```ts
// src/main/config/reassign-port.test.ts
import { describe, it, expect, vi } from 'vitest'
import { reassignPort, ReassignDeps } from './reassign-port'
import { CentralConfig, ResolvedProject } from './types'

function makeDeps(over: Partial<ReassignDeps> = {}, config?: CentralConfig): {
  deps: ReassignDeps
  saved: CentralConfig[]
} {
  const saved: CentralConfig[] = []
  const project: ResolvedProject = {
    name: 'bandai',
    directory: '/bandai',
    dependencies: [],
    components: {
      backend: {
        startCommand: 'boot --server.port=${port}',
        ports: [{ port: 8090, label: 'http' }, { port: 9090, label: 'admin' }]
      }
    }
  }
  const baseConfig: CentralConfig = config ?? {
    scanDirectories: [], scanIntervalMs: 0, portScanIntervalMs: 0,
    editor: '', terminal: '', gitGui: ''
  }
  const deps: ReassignDeps = {
    getProjects: () => new Map([['/bandai', project]]),
    getConfig: () => baseConfig,
    applyConfig: (c) => saved.push(c),
    isPortActive: () => false,
    isManagedRunning: () => false,
    ...over
  }
  return { deps, saved }
}

describe('reassignPort', () => {
  it('writes the complete port list as an override, preserving siblings', () => {
    const { deps, saved } = makeDeps()
    const res = reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8091)
    expect(res).toEqual({ ok: true })
    expect(saved).toHaveLength(1)
    expect(saved[0].overrides!.bandai.components!.backend.ports).toEqual([
      { port: 8091, label: 'http' },
      { port: 9090, label: 'admin' }
    ])
  })

  it('rejects an unknown project/component/label', () => {
    const { deps } = makeDeps()
    expect(reassignPort(deps, 'nope', 'backend', 'http', 8090, 8091).code).toBe('project-not-found')
    expect(reassignPort(deps, 'bandai', 'nope', 'http', 8090, 8091).code).toBe('component-not-found')
    expect(reassignPort(deps, 'bandai', 'backend', 'nope', 8090, 8091).code).toBe('declaration-not-found')
  })

  it('rejects a stale fromPort', () => {
    const { deps } = makeDeps()
    expect(reassignPort(deps, 'bandai', 'backend', 'http', 9999, 8091).code).toBe('stale-declaration')
  })

  it('rejects invalid destinations', () => {
    const { deps } = makeDeps()
    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8090).code).toBe('invalid-destination')
    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 70000).code).toBe('invalid-destination')
    // duplicate of a sibling port within the component
    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 9090).code).toBe('invalid-destination')
  })

  it('rejects an occupied destination and suggests the next free port', () => {
    const { deps } = makeDeps({ isPortActive: (p) => p === 8091 })
    const res = reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8091)
    expect(res.code).toBe('destination-occupied')
    expect(res.suggestedPort).toBe(8092)
  })

  it('rejects when the component is currently running (holder)', () => {
    const { deps } = makeDeps({ isManagedRunning: () => true })
    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8091).code).toBe('active-holder')
  })

  it('rejects when the declaration is not wired into the command/env', () => {
    const { deps } = makeDeps({
      getProjects: () =>
        new Map([['/bandai', {
          name: 'bandai', directory: '/bandai', dependencies: [],
          components: { backend: { startCommand: 'boot', ports: [{ port: 8090, label: 'http' }] } }
        }]])
    })
    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8091).code).toBe('missing-template')
  })

  it('reports persistence failure without leaving partial state', () => {
    const { deps } = makeDeps({ applyConfig: () => { throw new Error('disk full') } })
    expect(reassignPort(deps, 'bandai', 'backend', 'http', 8090, 8091).code).toBe('persist-failed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/config/reassign-port.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/config/reassign-port.ts
import { CentralConfig, ResolvedProject } from './types'
import { templateReferencesPortLabel } from './port-template'

export type ReassignErrorCode =
  | 'project-not-found'
  | 'component-not-found'
  | 'declaration-not-found'
  | 'stale-declaration'
  | 'invalid-destination'
  | 'destination-occupied'
  | 'missing-template'
  | 'active-holder'
  | 'persist-failed'

export interface ReassignResult {
  ok: boolean
  code?: ReassignErrorCode
  message?: string
  suggestedPort?: number
}

export interface ReassignDeps {
  getProjects: () => Map<string, ResolvedProject>
  getConfig: () => CentralConfig
  applyConfig: (config: CentralConfig) => void
  isPortActive: (port: number) => boolean
  isManagedRunning: (projectName: string, componentName: string) => boolean
}

function fail(code: ReassignErrorCode, message: string, suggestedPort?: number): ReassignResult {
  return { ok: false, code, message, suggestedPort }
}

function nextFreePort(
  from: number,
  isActive: (p: number) => boolean,
  declaredElsewhere: Set<number>
): number {
  let candidate = from + 1
  while (candidate <= 65535 && (isActive(candidate) || declaredElsewhere.has(candidate))) {
    candidate++
  }
  return candidate
}

export function reassignPort(
  deps: ReassignDeps,
  projectName: string,
  componentName: string,
  portLabel: string,
  fromPort: number,
  newPort: number
): ReassignResult {
  const project = [...deps.getProjects().values()].find((p) => p.name === projectName)
  if (!project) return fail('project-not-found', `Unknown project: ${projectName}`)

  const component = project.components[componentName]
  if (!component) return fail('component-not-found', `Unknown component: ${componentName}`)

  const declaration = component.ports.find((p) => p.label === portLabel)
  if (!declaration) return fail('declaration-not-found', `Unknown port label: ${portLabel}`)
  if (declaration.port !== fromPort) {
    return fail('stale-declaration', `Port :${fromPort} no longer matches ${portLabel}`)
  }

  if (!Number.isInteger(newPort) || newPort < 1 || newPort > 65535 || newPort === fromPort) {
    return fail('invalid-destination', `:${newPort} is not a valid new port`)
  }
  if (component.ports.some((p) => p.label !== portLabel && p.port === newPort)) {
    return fail('invalid-destination', `:${newPort} is already used by this component`)
  }

  if (deps.isManagedRunning(projectName, componentName)) {
    return fail('active-holder', 'Stop the component before reassigning its port')
  }

  const declaredElsewhere = new Set<number>()
  for (const proj of deps.getProjects().values()) {
    for (const [cName, comp] of Object.entries(proj.components)) {
      for (const p of comp.ports) {
        if (proj.name === projectName && cName === componentName && p.label === portLabel) continue
        declaredElsewhere.add(p.port)
      }
    }
  }
  if (deps.isPortActive(newPort) || declaredElsewhere.has(newPort)) {
    return fail(
      'destination-occupied',
      `:${newPort} is already declared or bound`,
      nextFreePort(fromPort, deps.isPortActive, declaredElsewhere)
    )
  }

  const templateTexts = [component.startCommand ?? '', ...Object.values(component.env ?? {})]
  if (!templateReferencesPortLabel(templateTexts, component.ports, portLabel)) {
    return fail(
      'missing-template',
      `Wire \${port${component.ports[0]?.label === portLabel ? '' : '.' + portLabel}} into the start command or env first`
    )
  }

  const newPorts = component.ports.map((p) =>
    p.label === portLabel ? { ...p, port: newPort } : { ...p }
  )

  const config = deps.getConfig()
  const next: CentralConfig = {
    ...config,
    overrides: {
      ...config.overrides,
      [projectName]: {
        ...config.overrides?.[projectName],
        components: {
          ...config.overrides?.[projectName]?.components,
          [componentName]: { ports: newPorts }
        }
      }
    }
  }

  try {
    deps.applyConfig(next)
  } catch (err) {
    return fail('persist-failed', err instanceof Error ? err.message : 'Failed to save config')
  }
  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/config/reassign-port.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/main/config/reassign-port.ts src/main/config/reassign-port.test.ts
git commit -m "feat(config): add reassignPort operation"
```

---

## Task 4: Wire `reassignPort` over IPC to the renderer

**Files:**
- Modify: `src/main/ipc/channels.ts` (add channel)
- Modify: `src/main/ipc/handlers.ts` (dep + handler)
- Modify: `src/main/index.ts` (closure passing registry/config/process-manager)
- Modify: `src/preload/index.ts` and `src/preload/index.d.ts`
- Modify: `src/renderer/src/context/AppContext.tsx` (action + type)

**Interfaces:**
- Consumes: `reassignPort`, `ReassignResult` from `../config/reassign-port`.
- Produces: `window.api.reassignPort(projectName, componentName, portLabel, fromPort, newPort): Promise<ReassignResult>` and `ctx.reassignPort(...)` with the same signature; renderer-side `ReassignResult` mirror type on `AppContext`.

- [ ] **Step 1: Add the channel + handler dep (no test-first; this is wiring verified by typecheck and Task 7's UI test)**

In `src/main/ipc/channels.ts`, add under "Process management":

```ts
  REASSIGN_PORT: 'config:reassign-port',
```

In `src/main/ipc/handlers.ts`, add to `HandlerDependencies`:

```ts
  reassignPort: (
    projectName: string,
    componentName: string,
    portLabel: string,
    fromPort: number,
    newPort: number
  ) => import('../config/reassign-port').ReassignResult
```

and register the handler inside `registerIpcHandlers`:

```ts
  ipcMain.handle(
    IPC_CHANNELS.REASSIGN_PORT,
    (_event, projectName: string, componentName: string, portLabel: string, fromPort: number, newPort: number) =>
      deps.reassignPort(projectName, componentName, portLabel, fromPort, newPort)
  )
```

- [ ] **Step 2: Wire the closure in `index.ts`**

Add the import near the other config imports:

```ts
import { reassignPort } from './config/reassign-port'
```

In the `registerIpcHandlers({ … })` object (alongside `saveConfig`), add:

```ts
    reassignPort: (projectName, componentName, portLabel, fromPort, newPort) => {
      const result = reassignPort(
        {
          getProjects: () => projectRegistry.getProjects(),
          getConfig: () => centralConfig,
          applyConfig: (config) => {
            centralConfig = config
            saveCentralConfig(config)
            projectRegistry.updateConfig(config)
          },
          isPortActive: (port) =>
            portMonitor.getState().conflicts.some((c) => c.port === port) ||
            [...portMonitor.getState().componentPorts.values()].some((ports) =>
              ports.some((p) => p.port === port && p.status !== 'free')
            ),
          isManagedRunning: (p, c) => processManager.isManagedRunning(p, c)
        },
        projectName,
        componentName,
        portLabel,
        fromPort,
        newPort
      )
      if (result.ok) pushState()
      return result
    },
```

- [ ] **Step 3: Expose in preload**

In `src/preload/index.ts`, add to the `api` object:

```ts
  reassignPort: (
    projectName: string,
    componentName: string,
    portLabel: string,
    fromPort: number,
    newPort: number
  ) => ipcRenderer.invoke('config:reassign-port', projectName, componentName, portLabel, fromPort, newPort),
```

In `src/preload/index.d.ts`, add to `ServiceStarterAPI`:

```ts
  reassignPort: (
    projectName: string,
    componentName: string,
    portLabel: string,
    fromPort: number,
    newPort: number
  ) => Promise<{ ok: boolean; code?: string; message?: string; suggestedPort?: number }>
```

- [ ] **Step 4: Add the renderer action + type in `AppContext.tsx`**

Add an exported type near the other `*View` types:

```ts
export interface ReassignResultView {
  ok: boolean
  code?: string
  message?: string
  suggestedPort?: number
}
```

Add to `AppContextType`:

```ts
  reassignPort: (
    projectName: string,
    componentName: string,
    portLabel: string,
    fromPort: number,
    newPort: number
  ) => Promise<ReassignResultView>
```

Add to the default context object:

```ts
  reassignPort: async () => ({ ok: false })
```

Add to the `value` object in `AppProvider`:

```ts
    reassignPort: (projectName, componentName, portLabel, fromPort, newPort) =>
      window.api.reassignPort(projectName, componentName, portLabel, fromPort, newPort),
```

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: clean.

```bash
git add src/main/ipc/channels.ts src/main/ipc/handlers.ts src/main/index.ts src/preload/index.ts src/preload/index.d.ts src/renderer/src/context/AppContext.tsx
git commit -m "feat(ipc): expose reassignPort to renderer"
```

---

## Task 5: `buildPatchbayRows` + `nextAvailablePort` (renderer util)

**Files:**
- Create: `src/renderer/src/utils/patchbayRows.ts`
- Test: `src/renderer/src/utils/patchbayRows.test.ts`

**Interfaces:**
- Consumes: `AppStateView`, `PortConflictView` from `../context/AppContext`.
- Produces:
  - `type PortRowKind = 'idle' | 'running' | 'contested' | 'held'`
  - `interface PatchbayClaimant { projectName: string; componentName: string; label: string; status: 'running' | 'stopped' | 'warning'; processOrigin: 'managed' | 'external' | 'none'; isHolder: boolean; pid?: number; process?: string }`
  - `interface PatchbayPortRow { port: number; kind: PortRowKind; claimants: PatchbayClaimant[]; externalHolder: boolean; holderPid?: number; holderProcess?: string }`
  - `buildPatchbayRows(state: AppStateView): PatchbayPortRow[]` (sorted ascending by port)
  - `nextAvailablePort(rows: PatchbayPortRow[], from: number): number`
  - `summarize(state: AppStateView): { services: number; running: number; contested: number; containersUp: number }`

- [ ] **Step 1: Write the failing test**

```ts
// src/renderer/src/utils/patchbayRows.test.ts
import { describe, it, expect } from 'vitest'
import { buildPatchbayRows, nextAvailablePort, summarize } from './patchbayRows'
import type { AppStateView } from '../context/AppContext'

function comp(name: string, status: 'running' | 'stopped', port: number, label = name, extra = {}) {
  return {
    [name]: {
      name, status, processOrigin: status === 'running' ? 'managed' : 'none',
      dependencies: [],
      ports: [{ port, label, status: 'free', ...extra }]
    }
  }
}

const state: AppStateView = {
  trayIcon: 'grey', favorites: [], conflicts: [],
  docker: { available: true, containers: [], missing: [] },
  projects: {
    bandai: { name: 'bandai', directory: '/bandai', dependencies: [], components: {
      ...comp('frontend', 'stopped', 3000)
    } },
    auto: { name: 'auto', directory: '/auto', dependencies: [], components: {
      ...comp('frontend', 'stopped', 5173)
    } },
    fmh: { name: 'fmh', directory: '/fmh', dependencies: [], components: {
      ...comp('frontend', 'stopped', 5173)
    } }
  }
}

describe('buildPatchbayRows', () => {
  it('sorts by port and marks a single idle claimant', () => {
    const rows = buildPatchbayRows(state)
    expect(rows.map((r) => r.port)).toEqual([3000, 5173])
    expect(rows[0].kind).toBe('idle')
    expect(rows[0].claimants).toHaveLength(1)
  })

  it('groups two claimants on one port as contested', () => {
    const rows = buildPatchbayRows(state)
    const row = rows.find((r) => r.port === 5173)!
    expect(row.kind).toBe('contested')
    expect(row.claimants.map((c) => c.projectName).sort()).toEqual(['auto', 'fmh'])
  })

  it('marks a running single claimant', () => {
    const s = { ...state, projects: { bandai: { ...state.projects.bandai,
      components: comp('frontend', 'running', 3000, 'frontend', { status: 'in-use', pid: 42, process: 'node' }) } } }
    expect(buildPatchbayRows(s)[0].kind).toBe('running')
  })

  it('marks held when one of several claimants is running, flagging the holder', () => {
    const s: AppStateView = { ...state, projects: {
      bandai: { name: 'bandai', directory: '/b', dependencies: [], components:
        comp('backend', 'running', 8090, 'http', { status: 'in-use', pid: 51002, process: 'java' }) },
      fmh: { name: 'fmh', directory: '/f', dependencies: [], components:
        comp('ocr', 'stopped', 8090, 'http') }
    } }
    const row = buildPatchbayRows(s).find((r) => r.port === 8090)!
    expect(row.kind).toBe('held')
    expect(row.claimants.find((c) => c.isHolder)?.projectName).toBe('bandai')
  })

  it('flags an external holder when a conflict has an active pid but no managed claimant', () => {
    const s: AppStateView = {
      ...state,
      conflicts: [{ port: 5173, type: 'runtime', claimants: ['auto/frontend', 'fmh/frontend'], activeProcess: 'vite', activePid: 999 }],
      projects: state.projects
    }
    const row = buildPatchbayRows(s).find((r) => r.port === 5173)!
    expect(row.externalHolder).toBe(true)
    expect(row.holderPid).toBe(999)
  })
})

describe('nextAvailablePort', () => {
  it('returns the lowest port above `from` not present in rows', () => {
    const rows = buildPatchbayRows(state)
    expect(nextAvailablePort(rows, 5173)).toBe(5174)
    expect(nextAvailablePort(rows, 3000)).toBe(3001)
  })
})

describe('summarize', () => {
  it('counts services, running, contested and containers up', () => {
    expect(summarize(state)).toEqual({ services: 3, running: 0, contested: 1, containersUp: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/utils/patchbayRows.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/renderer/src/utils/patchbayRows.ts
import type { AppStateView, PortConflictView } from '../context/AppContext'

export type PortRowKind = 'idle' | 'running' | 'contested' | 'held'

export interface PatchbayClaimant {
  projectName: string
  componentName: string
  label: string
  status: 'running' | 'stopped' | 'warning'
  processOrigin: 'managed' | 'external' | 'none'
  isHolder: boolean
  pid?: number
  process?: string
}

export interface PatchbayPortRow {
  port: number
  kind: PortRowKind
  claimants: PatchbayClaimant[]
  externalHolder: boolean
  holderPid?: number
  holderProcess?: string
}

interface RawClaimant extends PatchbayClaimant {}

export function buildPatchbayRows(state: AppStateView): PatchbayPortRow[] {
  const groups = new Map<number, RawClaimant[]>()

  for (const project of Object.values(state.projects)) {
    for (const component of Object.values(project.components)) {
      for (const port of component.ports) {
        const list = groups.get(port.port) ?? []
        list.push({
          projectName: project.name,
          componentName: component.name,
          label: port.label,
          status: component.status,
          processOrigin: component.processOrigin,
          isHolder: false,
          pid: port.pid,
          process: port.process
        })
        groups.set(port.port, list)
      }
    }
  }

  const conflictByPort = new Map<number, PortConflictView>()
  for (const c of state.conflicts) conflictByPort.set(c.port, c)

  const rows: PatchbayPortRow[] = []
  for (const [port, claimants] of groups) {
    const runningClaimant = claimants.find((c) => c.status === 'running')
    if (runningClaimant) runningClaimant.isHolder = true

    const conflict = conflictByPort.get(port)
    const externalHolder = claimants.length > 1 && !runningClaimant && !!conflict?.activePid

    let kind: PortRowKind
    if (claimants.length > 1) {
      kind = runningClaimant ? 'held' : 'contested'
    } else {
      kind = runningClaimant ? 'running' : 'idle'
    }

    rows.push({
      port,
      kind,
      claimants,
      externalHolder,
      holderPid: runningClaimant?.pid ?? conflict?.activePid,
      holderProcess: runningClaimant?.process ?? conflict?.activeProcess
    })
  }

  return rows.sort((a, b) => a.port - b.port)
}

export function nextAvailablePort(rows: PatchbayPortRow[], from: number): number {
  const taken = new Set(rows.map((r) => r.port))
  let candidate = from + 1
  while (candidate <= 65535 && taken.has(candidate)) candidate++
  return candidate
}

export function summarize(state: AppStateView): {
  services: number
  running: number
  contested: number
  containersUp: number
} {
  const components = Object.values(state.projects).flatMap((p) => Object.values(p.components))
  const rows = buildPatchbayRows(state)
  return {
    services: components.length,
    running: components.filter((c) => c.status === 'running').length,
    contested: rows.filter((r) => r.kind === 'contested' || r.kind === 'held').length,
    containersUp: state.docker.containers.filter((c) => c.state === 'running').length
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/utils/patchbayRows.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/utils/patchbayRows.ts src/renderer/src/utils/patchbayRows.test.ts
git commit -m "feat(dashboard): add patchbay row model"
```

---

## Task 6: `PatchbayHeader` component

**Files:**
- Create: `src/renderer/src/components/dashboard/PatchbayHeader.tsx`

**Interfaces:**
- Consumes: `summarize` output shape from Task 5.
- Produces: `PatchbayHeader({ summary, filter, onFilterChange }): React.JSX.Element` where `filter: 'all' | 'contested' | 'running'` and `onFilterChange(next): void`.

- [ ] **Step 1: Write the component (verified via Task 8's OverviewDetail test; this is presentational)**

```tsx
// src/renderer/src/components/dashboard/PatchbayHeader.tsx
export type PatchbayFilter = 'all' | 'contested' | 'running'

interface PatchbayHeaderProps {
  summary: { services: number; running: number; contested: number; containersUp: number }
  filter: PatchbayFilter
  onFilterChange: (next: PatchbayFilter) => void
}

const FILTERS: PatchbayFilter[] = ['all', 'contested', 'running']

export function PatchbayHeader({ summary, filter, onFilterChange }: PatchbayHeaderProps): React.JSX.Element {
  return (
    <div className="shrink-0 border-b border-white/[0.06] px-5 py-4">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[15px] font-semibold text-zinc-100">localhost</h2>
        <p className="text-[12px] text-zinc-500">
          {summary.services} services ·{' '}
          <span className="text-emerald-400">{summary.running} running</span> ·{' '}
          <span className={summary.contested > 0 ? 'text-amber-400' : undefined}>
            {summary.contested} contested
          </span>{' '}
          · {summary.containersUp} container{summary.containersUp === 1 ? '' : 's'} up
        </p>
        <div className="ml-auto flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`rounded-full px-2.5 py-1 text-[11px] capitalize transition-colors ${
                filter === f ? 'bg-white/[0.08] text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck:web`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/dashboard/PatchbayHeader.tsx
git commit -m "feat(dashboard): add patchbay header"
```

---

## Task 7: `PortRow` component with inline reassign picker

**Files:**
- Create: `src/renderer/src/components/dashboard/PortRow.tsx`
- Test: `src/renderer/src/components/dashboard/PortRow.test.tsx`

**Interfaces:**
- Consumes: `PatchbayPortRow`, `PatchbayClaimant`, `nextAvailablePort` from `../../utils/patchbayRows`; `ReassignResultView` from `../../context/AppContext`.
- Produces: `PortRow({ row, allRows, onRun, onStop, onReassign }): React.JSX.Element` where
  - `onRun(projectName, componentName): void`
  - `onStop(projectName, componentName): void`
  - `onReassign(projectName, componentName, portLabel, fromPort, newPort): Promise<ReassignResultView>`

Behaviour: `idle`→`Run`; `running`→`Stop`; `contested`/`held`→forked claimant lines + `Reassign`. The picker lets the user pick a **non-holder** claimant (holders are disabled), prefills `nextAvailablePort(allRows, row.port)`, and on Apply calls `onReassign`; a failing result keeps the picker open and shows `message`; success closes it.

- [ ] **Step 1: Write the failing test**

```tsx
// src/renderer/src/components/dashboard/PortRow.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PortRow } from './PortRow'
import type { PatchbayPortRow } from '../../utils/patchbayRows'

const contested: PatchbayPortRow = {
  port: 5173, kind: 'contested', externalHolder: false,
  claimants: [
    { projectName: 'auto', componentName: 'frontend', label: 'frontend', status: 'stopped', processOrigin: 'none', isHolder: false },
    { projectName: 'fmh', componentName: 'frontend', label: 'frontend', status: 'stopped', processOrigin: 'none', isHolder: false }
  ]
}

const held: PatchbayPortRow = {
  port: 8090, kind: 'held', externalHolder: false, holderPid: 51002, holderProcess: 'java',
  claimants: [
    { projectName: 'bandai', componentName: 'backend', label: 'http', status: 'running', processOrigin: 'managed', isHolder: true, pid: 51002, process: 'java' },
    { projectName: 'fmh', componentName: 'ocr', label: 'http', status: 'stopped', processOrigin: 'none', isHolder: false }
  ]
}

const noop = { onRun: () => {}, onStop: () => {} }

describe('PortRow', () => {
  it('runs an idle single claimant', () => {
    const onRun = vi.fn()
    render(<PortRow row={{ port: 3000, kind: 'idle', externalHolder: false, claimants: [
      { projectName: 'bandai', componentName: 'web', label: 'web', status: 'stopped', processOrigin: 'none', isHolder: false }
    ] }} allRows={[]} onReassign={async () => ({ ok: true })} onStop={() => {}} onRun={onRun} />)
    fireEvent.click(screen.getByRole('button', { name: /run/i }))
    expect(onRun).toHaveBeenCalledWith('bandai', 'web')
  })

  it('applies a reassign for the chosen non-holder claimant', async () => {
    const onReassign = vi.fn().mockResolvedValue({ ok: true })
    render(<PortRow row={contested} allRows={[contested]} onReassign={onReassign} {...noop} />)
    fireEvent.click(screen.getByRole('button', { name: /reassign/i }))
    fireEvent.click(screen.getByRole ? screen.getByText('fmh / frontend') : screen.getByText('fmh / frontend'))
    fireEvent.click(screen.getByRole('button', { name: /apply/i }))
    await waitFor(() =>
      expect(onReassign).toHaveBeenCalledWith('fmh', 'frontend', 'frontend', 5173, 5174)
    )
  })

  it('keeps the picker open and shows the error on failure', async () => {
    const onReassign = vi.fn().mockResolvedValue({ ok: false, code: 'missing-template', message: 'Wire ${port} first' })
    render(<PortRow row={contested} allRows={[contested]} onReassign={onReassign} {...noop} />)
    fireEvent.click(screen.getByRole('button', { name: /reassign/i }))
    fireEvent.click(screen.getByText('auto / frontend'))
    fireEvent.click(screen.getByRole('button', { name: /apply/i }))
    expect(await screen.findByText(/Wire \$\{port\} first/)).toBeInTheDocument()
  })

  it('disables the holder claimant in the picker', () => {
    render(<PortRow row={held} allRows={[held]} onReassign={async () => ({ ok: true })} {...noop} />)
    fireEvent.click(screen.getByRole('button', { name: /reassign/i }))
    const holderOption = screen.getByText('bandai / backend').closest('button')!
    expect(holderOption).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/dashboard/PortRow.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/renderer/src/components/dashboard/PortRow.tsx
import { useState } from 'react'
import type { PatchbayPortRow, PatchbayClaimant } from '../../utils/patchbayRows'
import { nextAvailablePort } from '../../utils/patchbayRows'
import type { ReassignResultView } from '../../context/AppContext'

interface PortRowProps {
  row: PatchbayPortRow
  allRows: PatchbayPortRow[]
  onRun: (projectName: string, componentName: string) => void
  onStop: (projectName: string, componentName: string) => void
  onReassign: (
    projectName: string,
    componentName: string,
    portLabel: string,
    fromPort: number,
    newPort: number
  ) => Promise<ReassignResultView>
}

function claimantId(c: PatchbayClaimant): string {
  return `${c.projectName}/${c.componentName}/${c.label}`
}

export function PortRow({ row, allRows, onRun, onStop, onReassign }: PortRowProps): React.JSX.Element {
  const selectable = row.claimants.filter((c) => !c.isHolder)
  const [picking, setPicking] = useState(false)
  const [selectedId, setSelectedId] = useState<string | undefined>(selectable[0] && claimantId(selectable[0]))
  const [newPort, setNewPort] = useState(() => nextAvailablePort(allRows, row.port))
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  const accent =
    row.kind === 'running'
      ? 'before:bg-emerald-400'
      : row.kind === 'contested'
        ? 'before:bg-amber-400'
        : row.kind === 'held'
          ? 'before:bg-gradient-to-b before:from-emerald-400 before:to-amber-400'
          : 'before:bg-transparent'
  const portColor =
    row.kind === 'running' ? 'text-emerald-400' : row.kind === 'contested' ? 'text-amber-400' : 'text-zinc-500'

  async function apply(): Promise<void> {
    const claimant = row.claimants.find((c) => claimantId(c) === selectedId)
    if (!claimant) return
    setBusy(true)
    setError(undefined)
    const result = await onReassign(claimant.projectName, claimant.componentName, claimant.label, row.port, newPort)
    setBusy(false)
    if (result.ok) {
      setPicking(false)
    } else {
      setError(result.message ?? 'Reassign failed')
      if (result.suggestedPort) setNewPort(result.suggestedPort)
    }
  }

  const single = row.claimants.length === 1 ? row.claimants[0] : undefined

  return (
    <div className={`relative border-b border-white/[0.04] before:absolute before:inset-y-0 before:left-0 before:w-0.5 ${accent}`}>
      <div className="flex min-h-[46px] items-center gap-3 pl-5 pr-5">
        <span className={`w-16 font-mono text-[16px] font-medium tabular-nums ${portColor}`}>{row.port}</span>

        {single ? (
          <>
            <span className="text-[13px] text-zinc-300">
              <span className="text-zinc-500">{single.projectName} /</span> {single.componentName}
            </span>
            <span className="ml-auto text-[11px] text-zinc-600">{single.label}</span>
            {row.kind === 'running' ? (
              <button
                onClick={() => onStop(single.projectName, single.componentName)}
                className="rounded-md border border-white/[0.12] px-2.5 py-1 text-[11px] text-zinc-300 hover:border-white/25"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={() => onRun(single.projectName, single.componentName)}
                className="rounded-md bg-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-900"
              >
                Run
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-1 py-2">
              {row.claimants.map((c) => (
                <div key={claimantId(c)} className="flex items-center gap-2 text-[12.5px]">
                  <span className={c.isHolder ? 'text-emerald-400' : 'text-zinc-400'}>
                    <span className="text-zinc-600">{c.projectName} /</span> {c.componentName}
                  </span>
                  <span className="ml-auto text-[11px] text-zinc-600">
                    {c.isHolder
                      ? `holding${row.holderPid ? ` · pid ${row.holderPid}` : ''}`
                      : row.kind === 'held'
                        ? 'blocked'
                        : c.label}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setPicking((v) => !v)}
              className="rounded-md border border-amber-500/40 px-2.5 py-1 text-[11px] text-amber-400 hover:border-amber-400"
            >
              Reassign
            </button>
          </>
        )}
      </div>

      {picking && (
        <div className="border-t border-amber-500/20 bg-zinc-800/40 px-5 py-3 pl-[84px]">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">
            Which one moves off :{row.port}?
          </div>
          <div className="flex flex-col gap-1">
            {row.claimants.map((c) => {
              const id = claimantId(c)
              const disabled = c.isHolder
              return (
                <button
                  key={id}
                  disabled={disabled}
                  onClick={() => setSelectedId(id)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] disabled:opacity-40 ${
                    selectedId === id ? 'bg-amber-400/10 text-zinc-100' : 'text-zinc-400 hover:bg-white/[0.03]'
                  }`}
                >
                  <span className={`h-3 w-3 rounded-full border ${selectedId === id ? 'border-4 border-amber-400' : 'border-zinc-600'}`} />
                  {c.projectName} / {c.componentName}
                  {disabled && <span className="ml-auto text-[11px] text-zinc-600">holding — stop first</span>}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-zinc-500">move to</span>
            <input
              aria-label="New port"
              value={newPort}
              onChange={(e) => setNewPort(Number(e.target.value) || 0)}
              className="w-20 rounded-md border border-white/[0.12] bg-zinc-900 px-2 py-1 font-mono text-[13px] text-amber-400"
            />
            <span className="text-[11px] text-zinc-600">saved as an override, manifest untouched</span>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setPicking(false)} className="rounded-md border border-white/[0.12] px-2.5 py-1 text-[11px] text-zinc-400">
                Cancel
              </button>
              <button onClick={apply} disabled={busy} className="rounded-md bg-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-900 disabled:opacity-50">
                Apply
              </button>
            </div>
          </div>
          {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}
```

Note for the implementer: the test's claimant-picker click targets text like `fmh / frontend`. Ensure the button text renders `"{project} / {component}"` exactly as above so `getByText('fmh / frontend')` matches. Remove the stray `screen.getByRole ? …` ternary in the test if your editor flags it — it is defensive and resolves to the same `getByText`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/dashboard/PortRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/dashboard/PortRow.tsx src/renderer/src/components/dashboard/PortRow.test.tsx
git commit -m "feat(dashboard): add PortRow with inline reassign picker"
```

---

## Task 8: Assemble the new `OverviewDetail`

**Files:**
- Modify: `src/renderer/src/components/dashboard/OverviewDetail.tsx` (full rewrite)
- Modify: `src/renderer/src/components/dashboard/OverviewDetail.test.tsx` (rewrite)
- Modify: `src/renderer/src/screenshots/fixtures.ts` (add a held/blocked port to a fixture)

**Interfaces:**
- Consumes: `buildPatchbayRows`, `summarize` (Task 5); `PatchbayHeader`, `PatchbayFilter` (Task 6); `PortRow` (Task 7); existing `DockerContainersSection`, `EmptyState`, `hasDockerContent`; `useAppState` for the run/stop/reassign actions.
- Produces: the new Overview view. `OverviewDetail` keeps its `{ state }` prop for test injection but reads actions from context.

- [ ] **Step 1: Rewrite the test first**

```tsx
// src/renderer/src/components/dashboard/OverviewDetail.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverviewDetail } from './OverviewDetail'
import type { AppStateView } from '../../context/AppContext'

vi.mock('../../context/AppContext', async (orig) => {
  const actual = await orig<typeof import('../../context/AppContext')>()
  return {
    ...actual,
    useAppState: () => ({
      startComponent: vi.fn(), stopComponent: vi.fn(),
      reassignPort: vi.fn().mockResolvedValue({ ok: true })
    })
  }
})

const state: AppStateView = {
  trayIcon: 'orange', favorites: [],
  conflicts: [{ port: 8090, type: 'static', claimants: ['bandai/backend', 'fmh/ocr'] }],
  projects: {
    bandai: { name: 'bandai', directory: '/b', dependencies: [], components: {
      backend: { name: 'backend', status: 'running', processOrigin: 'managed', dependencies: [],
        ports: [{ port: 8090, label: 'http', status: 'in-use', pid: 51002, process: 'java' }] }
    } },
    fmh: { name: 'fmh', directory: '/f', dependencies: [], components: {
      ocr: { name: 'ocr', status: 'stopped', processOrigin: 'none', dependencies: [],
        ports: [{ port: 8090, label: 'http', status: 'conflict' }] }
    } }
  },
  docker: { available: true, containers: [], missing: [] }
}

describe('OverviewDetail (patchbay)', () => {
  it('renders the summary header', () => {
    render(<OverviewDetail state={state} />)
    expect(screen.getByText('localhost')).toBeInTheDocument()
    expect(screen.getByText(/1 contested/)).toBeInTheDocument()
  })

  it('renders the held/blocked port once, not duplicated', () => {
    render(<OverviewDetail state={state} />)
    expect(screen.getAllByText('8090')).toHaveLength(1)
    expect(screen.getByText(/holding/)).toBeInTheDocument()
  })

  it('shows the empty state when there is nothing to show', () => {
    render(<OverviewDetail state={{ ...state, projects: {}, conflicts: [], docker: { available: true, containers: [], missing: [] } }} />)
    expect(screen.getByText(/No projects discovered/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/dashboard/OverviewDetail.test.tsx`
Expected: FAIL — old component still renders KPI cards / `8090` not found as expected.

- [ ] **Step 3: Rewrite `OverviewDetail.tsx`**

```tsx
// src/renderer/src/components/dashboard/OverviewDetail.tsx
import { useMemo, useState } from 'react'
import type { AppStateView } from '../../context/AppContext'
import { useAppState } from '../../context/AppContext'
import { buildPatchbayRows, summarize } from '../../utils/patchbayRows'
import { hasDockerContent } from '../../utils/dockerDisplay'
import { PatchbayHeader, PatchbayFilter } from './PatchbayHeader'
import { PortRow } from './PortRow'
import { DockerContainersSection } from './DockerContainersSection'
import { EmptyState } from './ui/EmptyState'

interface OverviewDetailProps {
  state: AppStateView
}

export function OverviewDetail({ state }: OverviewDetailProps): React.JSX.Element {
  const ctx = useAppState()
  const [filter, setFilter] = useState<PatchbayFilter>('all')

  const rows = useMemo(() => buildPatchbayRows(state), [state])
  const summary = useMemo(() => summarize(state), [state])

  const visibleRows = useMemo(() => {
    if (filter === 'contested') return rows.filter((r) => r.kind === 'contested' || r.kind === 'held')
    if (filter === 'running') return rows.filter((r) => r.kind === 'running' || r.kind === 'held')
    return rows
  }, [rows, filter])

  const projectCount = Object.keys(state.projects).length
  const showDocker = hasDockerContent(state.docker)

  if (projectCount === 0 && !showDocker) {
    return (
      <EmptyState
        title="No projects discovered"
        description="Add scan directories in Settings and place .service-starter.yml manifests in your projects."
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PatchbayHeader summary={summary} filter={filter} onFilterChange={setFilter} />
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-zinc-600">
          Ports
        </div>
        {visibleRows.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12px] text-zinc-500">No matching ports</p>
        ) : (
          visibleRows.map((row) => (
            <PortRow
              key={row.port}
              row={row}
              allRows={rows}
              onRun={(p, c) => void ctx.startComponent(p, c)}
              onStop={(p, c) => void ctx.stopComponent(p, c)}
              onReassign={(p, c, label, from, to) => ctx.reassignPort(p, c, label, from, to)}
            />
          ))
        )}
        {showDocker && (
          <div className="px-5 pt-6">
            <DockerContainersSection docker={state.docker} />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update fixtures, run the full suite + typecheck**

In `src/renderer/src/screenshots/fixtures.ts`, ensure at least one fixture has two components declaring the same port with one `status: 'running'` (held) — mirror the `state` object from Step 1 if no such case exists. (Open the file, find the primary dashboard fixture, and add an `fmh`-style second claimant on an existing running component's port.)

Run: `npx vitest run && npm run typecheck`
Expected: PASS across the suite; typecheck clean. If `OverviewDetail.test.tsx`'s context mock collides with other suites, keep the mock local to that file (it already is).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/dashboard/OverviewDetail.tsx src/renderer/src/components/dashboard/OverviewDetail.test.tsx src/renderer/src/screenshots/fixtures.ts
git commit -m "feat(dashboard): patchbay Overview page"
```

---

## Task 9: Cleanup + verification

**Files:**
- Modify/remove: `src/renderer/src/utils/dashboardStats.ts` + test (only if unused elsewhere)
- Modify: `src/renderer/src/components/dashboard/ui/KpiCard.tsx` (remove only if unused elsewhere)

- [ ] **Step 1: Find remaining consumers**

Run: `grep -rn "computeKpis\|KpiCard\|buildPortRows" src/renderer`
Expected: only matches inside files already replaced. If `KpiCard`/`computeKpis` have no other consumers, delete them and their tests; otherwise leave them.

- [ ] **Step 2: Delete dead code (only if Step 1 shows no other consumers)**

```bash
git rm src/renderer/src/utils/dashboardStats.ts src/renderer/src/utils/dashboardStats.test.ts src/renderer/src/components/dashboard/ui/KpiCard.tsx
```

- [ ] **Step 3: Full verification**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all green.

- [ ] **Step 4: Drive the real app once**

Run: `npm run dev`, open the dashboard, confirm: contested `:5173`/`:8090` render as forked rows; the held row shows `holding · pid …` on the running claimant and `blocked` on the other; Reassign opens the picker, disables the holder, and Apply on a templated non-holder heals the row; Apply on a non-templated component shows the `missing-template` error inline.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(dashboard): remove dead KPI/portmap code after patchbay migration"
```

---

## Self-Review notes

- **Spec coverage:** row states (Task 5/7), holder-vs-blocked incl. external holder (Task 5), header summary + filter (Task 6/8), Docker section reused (Task 8), `${port}` templating incl. fail-closed + label rules (Task 1/2), reassign operation with all listed error codes + sibling preservation + typed result (Task 3), IPC/preload/context wiring (Task 4), honesty guard as a hard main-side reject surfaced inline (Task 3 `missing-template` + Task 7 error display), tests incl. fixtures (each task + Task 8), out-of-scope respected (no tray/Settings restyle; no container create; no run history).
- **Latent env-resolution gap:** the spec marks fixing `${ENV_VAR}` non-resolution on the spawn path as optional/out-of-owned-scope. Task 2 resolves only `${port}` in env values and leaves `${ENV_VAR}` behaviour unchanged; not folded in, to avoid scope creep. Flagged here for a possible follow-up.
- **Type consistency:** `ReassignResult` (main, `reassign-port.ts`) ↔ `ReassignResultView` (renderer, `AppContext.tsx`) ↔ preload return type all share `{ ok, code?, message?, suggestedPort? }`. `reassignPort` arg order `(projectName, componentName, portLabel, fromPort, newPort)` is identical across `reassign-port.ts`, IPC handler, preload, context, and `PortRow.onReassign`.
