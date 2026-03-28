import { readFileSync, existsSync } from 'fs'
import { join, basename } from 'path'
import * as yaml from 'js-yaml'
import { ProjectManifest, ComponentConfig, Dependency, PortDeclaration } from './types'

const MANIFEST_FILENAME = '.service-starter.yml'

export function getManifestPath(projectDir: string): string {
  return join(projectDir, MANIFEST_FILENAME)
}

export function manifestExists(projectDir: string): boolean {
  return existsSync(getManifestPath(projectDir))
}

export interface ParseResult {
  manifest: ProjectManifest | null
  errors: string[]
}

export function parseManifest(projectDir: string): ParseResult {
  const manifestPath = getManifestPath(projectDir)
  const errors: string[] = []

  if (!existsSync(manifestPath)) {
    return { manifest: null, errors: ['Manifest file not found'] }
  }

  let raw: string
  try {
    raw = readFileSync(manifestPath, 'utf-8')
  } catch (err) {
    return { manifest: null, errors: [`Failed to read manifest: ${err}`] }
  }

  let parsed: unknown
  try {
    parsed = yaml.load(raw)
  } catch (err) {
    return { manifest: null, errors: [`Invalid YAML: ${err}`] }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { manifest: null, errors: ['Manifest is empty or not an object'] }
  }

  const data = parsed as Record<string, unknown>

  // Validate name
  const name = typeof data.name === 'string' ? data.name : basename(projectDir)
  if (!data.name) {
    errors.push('Missing "name" field, using directory name as fallback')
  }

  // Validate components
  const components: Record<string, ComponentConfig> = {}
  if (data.components && typeof data.components === 'object') {
    for (const [key, value] of Object.entries(data.components as Record<string, unknown>)) {
      const comp = parseComponent(key, value, errors)
      if (comp) {
        components[key] = comp
      }
    }
  } else {
    errors.push('Missing or invalid "components" field')
  }

  // Validate top-level dependencies
  const dependencies = parseDependencies(data.dependencies, errors)

  return {
    manifest: { name, components, dependencies: dependencies.length > 0 ? dependencies : undefined },
    errors
  }
}

function parseComponent(
  name: string,
  raw: unknown,
  errors: string[]
): ComponentConfig | null {
  if (!raw || typeof raw !== 'object') {
    errors.push(`Component "${name}" is not an object`)
    return null
  }

  const data = raw as Record<string, unknown>

  const ports: PortDeclaration[] = []
  if (Array.isArray(data.ports)) {
    for (const p of data.ports) {
      if (p && typeof p === 'object' && typeof (p as Record<string, unknown>).port === 'number') {
        ports.push({
          port: (p as Record<string, unknown>).port as number,
          label:
            typeof (p as Record<string, unknown>).label === 'string'
              ? ((p as Record<string, unknown>).label as string)
              : `Port ${(p as Record<string, unknown>).port}`
        })
      } else {
        errors.push(`Component "${name}" has invalid port entry`)
      }
    }
  }

  const env: Record<string, string> | undefined =
    data.env && typeof data.env === 'object'
      ? Object.fromEntries(
          Object.entries(data.env as Record<string, unknown>).map(([k, v]) => [k, String(v)])
        )
      : undefined

  const dependencies = parseDependencies(data.dependencies, errors)

  return {
    workDir: typeof data.workDir === 'string' ? data.workDir : undefined,
    codeDir: typeof data.codeDir === 'string' ? data.codeDir : undefined,
    startCommand: typeof data.startCommand === 'string' ? data.startCommand : undefined,
    ports,
    env,
    dependencies: dependencies.length > 0 ? dependencies : undefined
  }
}

function parseDependencies(raw: unknown, errors: string[]): Dependency[] {
  if (!Array.isArray(raw)) return []

  const deps: Dependency[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      errors.push('Invalid dependency entry')
      continue
    }

    const d = item as Record<string, unknown>
    const type = d.type as string

    switch (type) {
      case 'docker':
        if (typeof d.container === 'string') {
          deps.push({
            type: 'docker',
            container: d.container,
            image: typeof d.image === 'string' ? d.image : undefined
          })
        } else {
          errors.push('Docker dependency missing "container" field')
        }
        break

      case 'service':
        if (typeof d.name === 'string' && typeof d.check === 'string') {
          deps.push({ type: 'service', name: d.name, check: d.check })
        } else {
          errors.push('Service dependency missing "name" or "check" field')
        }
        break

      case 'api':
        if (typeof d.name === 'string' && typeof d.check === 'string') {
          deps.push({
            type: 'api',
            name: d.name,
            check: d.check,
            envRequired: Array.isArray(d.envRequired)
              ? d.envRequired.map(String)
              : undefined
          })
        } else {
          errors.push('API dependency missing "name" or "check" field')
        }
        break

      case 'project':
        if (typeof d.name === 'string') {
          deps.push({ type: 'project', name: d.name })
        } else {
          errors.push('Project dependency missing "name" field')
        }
        break

      default:
        errors.push(`Unknown dependency type: "${type}"`)
    }
  }

  return deps
}
