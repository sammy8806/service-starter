# README Redesign — Design Spec

**Date:** 2026-05-25
**Goal:** Replace the boilerplate electron-vite README with a developer-facing page that communicates what service-starter actually does and gets a curious developer from "what is this?" to "I want to try it" in under 30 seconds.

## Context

The project has just been published to GitHub. The current README is the unmodified electron-vite scaffold ("An Electron application with React and TypeScript"). A random developer landing on the repo has no idea what the app does.

## Target audience

Developers who might use service-starter as a tool on their own machine. Not contributors. No pre-built binaries yet — users clone and build.

## Lead hook

Auto-discovery: drop a `.service-starter.yml` in any project, and the app picks it up automatically. This is the single most compelling feature and should be the first thing a skimmer understands.

## Structure (Approach B — screenshot-first, YAML-hook)

### 1. Title + one-liner
```
# service-starter
A system tray app that auto-discovers your dev projects and keeps an eye on ports and dependencies.
```

### 2. Screenshot
`docs/screenshot-tray-overview.png` — no heading, placed immediately after the one-liner. Full-width image, no caption needed.

### 3. The hook
A blockquote lead-in: "Drop one file in any project:" followed by the minimal `.service-starter.yml` snippet (name + one component + one port). Immediately below: "service-starter picks it up automatically — no config, no restart."

Minimal snippet to use:
```yaml
name: my-api
components:
  api:
    startCommand: npm run dev
    ports:
      - port: 3000
        label: API Server
```

### 4. Feature bullets (4 max, no prose)
- Auto-discovers projects by scanning configured directories for `.service-starter.yml` files
- Monitors port usage — shows what's running, what's idle, flags conflicts
- Checks dependency health: Docker containers, shell services, external APIs
- Quick actions from the tray: open in editor, open terminal, open in browser

### 5. Getting started
Three steps:
1. Clone and install: `git clone` + `npm install`
2. Build for platform: `npm run build:mac` / `build:linux` / `build:win`
3. Configure scan directories in `~/.config/service-starter/config.yml` (auto-created on first run with sensible defaults)

### 6. Config snippet
Short example of `~/.config/service-starter/config.yml` showing `scanDirectories`, `editor`, and `terminal` — the fields a new user is most likely to want to change.

```yaml
scanDirectories:
  - ~/work
  - ~/projects
editor: code
terminal: iterm
```

### 7. Manifest reference
Single sentence + link: "For the full `.service-starter.yml` field reference and more examples, see [docs/manifest-examples.md](docs/manifest-examples.md)."

## Tone

Terse. No marketing language. No exclamation marks. Written like a developer wrote it for other developers.

## Out of scope

- Badges (no CI set up yet)
- Contributing guide
- License section (can be added later)
- Screenshots of the dashboard view (only tray overview for now)
