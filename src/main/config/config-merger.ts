import { CentralConfig, ProjectManifest, ResolvedProject, ComponentConfig, Dependency } from './types'

/**
 * Merges a project manifest with central config overrides to produce a resolved project.
 */
export function mergeConfig(
  manifest: ProjectManifest,
  projectDir: string,
  centralConfig: CentralConfig
): ResolvedProject {
  const overrides = centralConfig.overrides?.[manifest.name]

  const components: Record<string, ComponentConfig> = {}

  for (const [name, component] of Object.entries(manifest.components)) {
    const componentOverride = overrides?.components?.[name]

    components[name] = {
      ...component,
      // Override ports if specified in central config
      ports: componentOverride?.ports ?? component.ports
    }
  }

  // Collect all dependencies: project-level + component-level
  const allDependencies: Dependency[] = [...(manifest.dependencies ?? [])]

  return {
    name: manifest.name,
    directory: projectDir,
    components,
    dependencies: allDependencies
  }
}
