export interface SearchableRow {
  projectName: string
  componentName?: string
  ports: number[]
}

export function searchMatcher(query: string, row: SearchableRow): boolean {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  const haystack = (
    row.componentName ? `${row.projectName}/${row.componentName}` : row.projectName
  ).toLowerCase()
  const portStrings = row.ports.map((p) => String(p))

  return tokens.every((token) => {
    if (haystack.includes(token)) return true
    const portToken = token.startsWith(':') ? token.slice(1) : token
    if (portToken.length > 0 && /^\d+$/.test(portToken)) {
      return portStrings.some((p) => p.startsWith(portToken))
    }
    return false
  })
}
