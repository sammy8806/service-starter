# Generate `.service-starter.yml`

This document is only for generating a project-local `.service-starter.yml` in another repository.

Use it when an agent needs to inspect an existing codebase and produce a Service Starter manifest at the repo root.

## Goal

Produce a `.service-starter.yml` that is accurate enough for Service Starter to:

- identify the project
- list independently runnable local-development components
- show expected local ports
- prefill valid start commands
- surface relevant local dependencies

## Inputs To Inspect

Before writing the manifest, inspect the target repository for:

1. workspace and package-manager files:
   - `package.json`
   - `pnpm-workspace.yaml`
   - `turbo.json`
   - `nx.json`
   - `lerna.json`
2. app and service definitions:
   - frontend apps
   - backend services
   - workers
   - docs/storybook apps
3. dev commands:
   - npm/pnpm/yarn/bun scripts
   - Make targets
   - Gradle/Maven commands
   - Docker Compose commands
   - README setup instructions
4. expected local ports:
   - Vite
   - Next.js
   - CRA
   - Express
   - Spring Boot
   - Storybook
   - docs sites
   - health/debug ports
5. dependencies needed for local development:
   - Docker containers from `docker-compose.yml` or `compose.yml`
   - required local/background services
   - external APIs with required env vars
   - other local projects the repo depends on

## Authoring Rules

- Write the manifest to `.service-starter.yml` at the project root.
- Prefer one component per independently runnable app or service.
- Use paths relative to the project root.
- Include `workDir` only when the component does not run from the repo root.
- Include `codeDir` only when it points to a meaningfully better editor target than `workDir`.
- Include `startCommand` only when there is evidence for an established local-dev command.
- Include only ports that are actually expected in local development.
- Put `dependencies` at project level only when they apply to the whole repo.
- Put `dependencies` at component level when they are specific to one component.
- Use `${VAR}` only for env vars that should come from the shell environment.
- Do not invent commands, ports, containers, dependencies, or env vars.
- If evidence is weak or ambiguous, omit the field and note the gap.

## Manifest Shape

Use the manifest structure documented in [manifest-examples.md](/Users/steven/work/service-starter/docs/manifest-examples.md) and the spec at [2026-03-28-service-starter-design.md](/Users/steven/work/service-starter/docs/superpowers/specs/2026-03-28-service-starter-design.md).

Core shape:

```yaml
name: project-name
components:
  component-name:
    workDir: ./path
    codeDir: ./path
    startCommand: npm run dev
    ports:
      - port: 3000
        label: App
    env:
      API_URL: http://localhost:8080
      SECRET_KEY: ${SECRET_KEY}
    dependencies:
      - type: docker
        container: postgres
dependencies:
  - type: project
    name: shared-api
```

## Recommended Process

1. Inspect repo-level files and docs first.
2. Identify each independently runnable dev component.
3. Determine each component's `workDir`.
4. Infer `startCommand` from scripts or documented workflows.
5. Infer `ports` from config, scripts, or docs.
6. Add `codeDir` only when it improves "Open in Editor".
7. Add component-level and project-level dependencies.
8. Write `.service-starter.yml`.
9. Summarize evidence and assumptions.

## Expected Output

When another agent performs this task, it should return:

1. the final `.service-starter.yml`
2. an `Evidence` section showing which files or docs justified each component, command, port, and dependency
3. an `Assumptions / Gaps` section listing unresolved ambiguities

## Copy-Paste Prompt

```text
Inspect this repository and generate a `.service-starter.yml` at the repo root for Service Starter.

Requirements:
- Discover the actual runnable local-development components from the repo structure and scripts.
- Use the manifest shape from `docs/manifest-examples.md` and `docs/superpowers/specs/2026-03-28-service-starter-design.md`.
- Prefer evidence from project files over guesses.
- Include `name`, `components`, and any justified `dependencies`.
- For each component, include `workDir`, `codeDir`, `startCommand`, `ports`, `env`, and `dependencies` only when supported by evidence.
- Keep all paths relative to the project root.
- Do not invent ports, commands, containers, dependencies, or env vars. If something is unclear, omit it and call it out.

Process:
1. Inspect repo-level files such as `package.json`, workspace config, Docker Compose files, backend build files, README/setup docs, and app-specific configs.
2. Identify each independently runnable dev component and its working directory.
3. Infer expected dev ports from scripts, configs, and docs.
4. Identify local Docker, service, API, and cross-project dependencies.
5. Write `.service-starter.yml`.
6. Summarize the evidence and assumptions briefly.

Output format:
- First: the final YAML
- Then: `Evidence`
- Then: `Assumptions / Gaps`
```
