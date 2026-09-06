# Service Starter Manifest Examples

Add a `.service-starter.yml` file to the root of any project directory that is inside a configured scan directory (default: `~/work`).

## Minimal

```yaml
name: marketing-site
components:
  web:
    startCommand: npm run dev
    ports:
      - port: 4000
        label: Dev Server
```

## Single API with dependencies

```yaml
name: my-api-service
components:
  api:
    workDir: ./
    codeDir: ./src
    startCommand: npm run dev
    ports:
      - port: 3000
        label: API Server
    env:
      NODE_ENV: development
      DATABASE_URL: ${DATABASE_URL}
    dependencies:
      - type: docker
        container: postgres-dev
      - type: service
        name: tailscale
        check: tailscale status
```

## Spring Boot backend

```yaml
name: billing-service
components:
  api:
    workDir: ./
    codeDir: ./src/main
    startCommand: ./gradlew bootRun
    ports:
      - port: 8080
        label: Spring Boot
      - port: 5005
        label: Debug
    dependencies:
      - type: docker
        composeService: postgres
      - type: docker
        composeService: redis
      - type: api
        name: stripe
        check: curl -sf https://api.stripe.com/v1 -o /dev/null
        envRequired:
          - STRIPE_SECRET_KEY
```

## Multi-component monorepo

```yaml
name: platform
components:
  frontend:
    workDir: ./packages/web
    codeDir: ./packages/web/src
    startCommand: npm run dev
    ports:
      - port: 5173
        label: Vite Dev
  backend:
    workDir: ./packages/api
    codeDir: ./packages/api/src
    startCommand: npm run dev
    ports:
      - port: 3000
        label: API
    dependencies:
      - type: docker
        container: platform-db
      - type: docker
        container: platform-redis
  docs:
    workDir: ./packages/docs
    startCommand: npm run dev
    ports:
      - port: 4321
        label: Docs Site
dependencies:
  - type: service
    name: docker
    check: docker info
```

## Cross-project dependency

```yaml
name: dashboard
components:
  web:
    startCommand: npm run dev
    ports:
      - port: 5173
        label: Dashboard UI
dependencies:
  - type: project
    name: my-api-service
```

## Short-lived command

Commands use the same component lifecycle and captured logs as services, but
they are expected to finish and do not need a port declaration:

```yaml
name: billing
components:
  migrate:
    type: command
    command: npm run db:migrate
    workDir: ./api
    env:
      NODE_ENV: development
```

The command appears as running while it is executing, then returns to idle when
it exits. Starting it from the tray opens a wide live log window; its output
also remains available from the component's Logs action and can be run again.
`startCommand` is also accepted for command components.

## Field reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Project name (used for display and cross-project references) |
| `components` | yes | Map of component name to config |
| `components.*.workDir` | no | Working directory, relative to project root (default: `./`) |
| `components.*.codeDir` | no | Source directory for "Open in Editor" (default: workDir) |
| `components.*.type` | no | `service` (default) or `command` for a short-lived process |
| `components.*.command` | no | Command to run for a `command` component |
| `components.*.startCommand` | no | Command to run for a service; also accepted for command components |
| `components.*.ports` | no | List of `{port, label}` objects; normally omitted for commands |
| `components.*.env` | no | Key-value pairs; `${VAR}` references resolved from shell env |
| `components.*.dependencies` | no | Component-level dependencies |
| `dependencies` | no | Project-level dependencies |

Docker dependencies can reference a service from the project's default Compose file. Service Starter resolves its `container_name` and `image`, so those values stay owned by Compose:

```yaml
dependencies:
  - type: docker
    composeService: postgres
```

The default file lookup order is `compose.yaml`, `compose.yml`, `docker-compose.yml`, then `docker-compose.yaml`. For another file, add `composeFile: compose.dev.yml`. Use `container` (and optionally `image`) instead for standalone or externally managed containers.

### Dependency types

| Type | Required fields | How it checks |
|------|----------------|---------------|
| `docker` | `composeService` or `container` | Resolves Compose metadata when requested, then checks the container via Docker API |
| `service` | `name`, `check` | Runs shell command; exit 0 = healthy |
| `api` | `name`, `check` | Runs shell command + verifies `envRequired` vars are set |
| `project` | `name` | Checks if referenced project has active ports |
