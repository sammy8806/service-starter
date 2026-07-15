import { existsSync, readFileSync } from 'fs'
import { basename, isAbsolute, join, relative, resolve } from 'path'
import * as yaml from 'js-yaml'

const DEFAULT_COMPOSE_FILES = [
  'compose.yaml',
  'compose.yml',
  'docker-compose.yml',
  'docker-compose.yaml'
]

export interface ResolvedComposeService {
  container: string
  image?: string
  composeFile: string
}

export interface ComposeResolution {
  service?: ResolvedComposeService
  error?: string
}

function composePath(projectDir: string, requestedFile?: string): string | undefined {
  if (requestedFile) {
    const requestedPath = isAbsolute(requestedFile)
      ? requestedFile
      : resolve(projectDir, requestedFile)
    return existsSync(requestedPath) ? requestedPath : undefined
  }

  return DEFAULT_COMPOSE_FILES.map((file) => join(projectDir, file)).find(existsSync)
}

function displayPath(projectDir: string, filePath: string): string {
  const projectRelative = relative(projectDir, filePath)
  return projectRelative && !projectRelative.startsWith('..') ? projectRelative : basename(filePath)
}

export function resolveComposeService(
  projectDir: string,
  serviceName: string,
  requestedFile?: string
): ComposeResolution {
  const filePath = composePath(projectDir, requestedFile)
  if (!filePath) {
    const description = requestedFile ? `Compose file "${requestedFile}"` : 'Compose file'
    return { error: `${description} not found` }
  }

  let parsed: unknown
  try {
    parsed = yaml.load(readFileSync(filePath, 'utf-8'))
  } catch (err) {
    return { error: `Failed to read ${displayPath(projectDir, filePath)}: ${String(err)}` }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { error: `${displayPath(projectDir, filePath)} is empty or invalid` }
  }

  const services = (parsed as Record<string, unknown>).services
  if (!services || typeof services !== 'object') {
    return { error: `${displayPath(projectDir, filePath)} has no services` }
  }

  const rawService = (services as Record<string, unknown>)[serviceName]
  if (!rawService || typeof rawService !== 'object') {
    return {
      error: `Compose service "${serviceName}" not found in ${displayPath(projectDir, filePath)}`
    }
  }

  const service = rawService as Record<string, unknown>
  return {
    service: {
      container: typeof service.container_name === 'string' ? service.container_name : serviceName,
      image: typeof service.image === 'string' ? service.image : undefined,
      composeFile: displayPath(projectDir, filePath)
    }
  }
}
