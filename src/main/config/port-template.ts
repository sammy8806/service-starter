import { PortDeclaration } from './types'

/** Matches ${port} and ${port.<label>}. A fresh RegExp per call avoids shared lastIndex bugs. */
const PATTERN_SOURCE = '\\$\\{port(?:\\.([^}]+))?\\}'

export function validatePortLabels(ports: PortDeclaration[]): string | undefined {
  const seen = new Set<string>()

  for (const declaration of ports) {
    if (!declaration.label || declaration.label.trim() === '') {
      return 'Port declaration has an empty label'
    }
    if (seen.has(declaration.label)) {
      return `Duplicate port label: ${declaration.label}`
    }
    seen.add(declaration.label)
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

    const declaration = ports.find((port) => port.label === label)
    if (!declaration) {
      error = `Unknown port label: ${label}`
      return match
    }
    return String(declaration.port)
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
    const pattern = new RegExp(PATTERN_SOURCE, 'g')
    let match: RegExpExecArray | null

    while ((match = pattern.exec(text)) !== null) {
      const referencedLabel = match[1]
      if (referencedLabel === undefined && isFirst) return true
      if (referencedLabel === label) return true
    }

    return false
  })
}
