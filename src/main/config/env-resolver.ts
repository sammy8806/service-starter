export interface EnvResolutionResult {
  resolved: Record<string, string>
  missing: string[]
}

const ENV_VAR_PATTERN = /\$\{([^}]+)\}/g

/**
 * Resolves `${VAR}` references in env values against process.env.
 * Returns the resolved map and a list of missing variable names.
 */
export function resolveEnvVars(
  env: Record<string, string>,
  processEnv: Record<string, string | undefined> = process.env
): EnvResolutionResult {
  const resolved: Record<string, string> = {}
  const missing: string[] = []

  for (const [key, value] of Object.entries(env)) {
    let result = value
    let match: RegExpExecArray | null

    // Reset lastIndex for global regex
    ENV_VAR_PATTERN.lastIndex = 0

    while ((match = ENV_VAR_PATTERN.exec(value)) !== null) {
      const varName = match[1]
      const envValue = processEnv[varName]

      if (envValue !== undefined) {
        result = result.replace(match[0], envValue)
      } else {
        if (!missing.includes(varName)) {
          missing.push(varName)
        }
      }
    }

    resolved[key] = result
  }

  return { resolved, missing }
}

/**
 * Checks if all required env vars are present in process.env.
 * Returns list of missing variable names.
 */
export function checkRequiredEnvVars(
  required: string[],
  processEnv: Record<string, string | undefined> = process.env
): string[] {
  return required.filter((varName) => processEnv[varName] === undefined)
}
