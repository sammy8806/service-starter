import { getComponentCommand, type CentralConfig, type ResolvedProject } from './types'
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
  return suggestedPort === undefined
    ? { ok: false, code, message }
    : { ok: false, code, message, suggestedPort }
}

function nextFreePort(
  from: number,
  isActive: (port: number) => boolean,
  declaredElsewhere: Set<number>
): number | undefined {
  let candidate = from + 1
  while (candidate <= 65535 && (isActive(candidate) || declaredElsewhere.has(candidate))) {
    candidate++
  }
  return candidate <= 65535 ? candidate : undefined
}

export function reassignPort(
  deps: ReassignDeps,
  projectName: string,
  componentName: string,
  portLabel: string,
  fromPort: number,
  newPort: number
): ReassignResult {
  const projects = deps.getProjects()
  const project = [...projects.values()].find((candidate) => candidate.name === projectName)
  if (!project) return fail('project-not-found', `Unknown project: ${projectName}`)

  const component = project.components[componentName]
  if (!component) return fail('component-not-found', `Unknown component: ${componentName}`)

  const declaration = component.ports.find((port) => port.label === portLabel)
  if (!declaration) return fail('declaration-not-found', `Unknown port label: ${portLabel}`)
  if (declaration.port !== fromPort) {
    return fail('stale-declaration', `Port :${fromPort} no longer matches ${portLabel}`)
  }

  if (!Number.isInteger(newPort) || newPort < 1 || newPort > 65535 || newPort === fromPort) {
    return fail('invalid-destination', `:${newPort} is not a valid new port`)
  }
  if (component.ports.some((port) => port.label !== portLabel && port.port === newPort)) {
    return fail('invalid-destination', `:${newPort} is already used by this component`)
  }

  if (deps.isManagedRunning(projectName, componentName)) {
    return fail('active-holder', 'Stop the component before reassigning its port')
  }

  const declaredElsewhere = new Set<number>()
  for (const candidateProject of projects.values()) {
    for (const [candidateName, candidateComponent] of Object.entries(candidateProject.components)) {
      for (const port of candidateComponent.ports) {
        const isSelected =
          candidateProject.name === projectName &&
          candidateName === componentName &&
          port.label === portLabel
        if (!isSelected) declaredElsewhere.add(port.port)
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

  const templateTexts = [getComponentCommand(component) ?? '', ...Object.values(component.env ?? {})]
  if (!templateReferencesPortLabel(templateTexts, component.ports, portLabel)) {
    const placeholder =
      component.ports[0]?.label === portLabel ? '${port}' : `\${port.${portLabel}}`
    return fail(
      'missing-template',
      `Wire ${placeholder} into the start command or env before reassigning this port`
    )
  }

  const newPorts = component.ports.map((port) =>
    port.label === portLabel ? { ...port, port: newPort } : { ...port }
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
          [componentName]: {
            ...config.overrides?.[projectName]?.components?.[componentName],
            ports: newPorts
          }
        }
      }
    }
  }

  try {
    deps.applyConfig(next)
  } catch (error) {
    return fail('persist-failed', error instanceof Error ? error.message : 'Failed to save config')
  }

  return { ok: true }
}
