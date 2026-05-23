import { describe, it, expect } from 'vitest'
import { searchMatcher, SearchableRow } from './searchMatcher'

const row = (over: Partial<SearchableRow> = {}): SearchableRow => ({
  projectName: 'bandai',
  componentName: 'frontend',
  ports: [3000],
  ...over
})

describe('searchMatcher', () => {
  it('matches everything on an empty query', () => {
    expect(searchMatcher('', row())).toBe(true)
    expect(searchMatcher('   ', row())).toBe(true)
  })

  it('matches a substring of project/component, case-insensitive', () => {
    expect(searchMatcher('FRONT', row())).toBe(true)
    expect(searchMatcher('bandai/front', row())).toBe(true)
    expect(searchMatcher('backend', row())).toBe(false)
  })

  it('matches a port prefix, with or without a leading colon', () => {
    expect(searchMatcher('30', row())).toBe(true)
    expect(searchMatcher(':30', row())).toBe(true)
    expect(searchMatcher(':81', row())).toBe(false)
  })

  it('requires every whitespace-separated token to match (AND)', () => {
    expect(searchMatcher('band 3000', row())).toBe(true)
    expect(searchMatcher('band 9999', row())).toBe(false)
  })

  it('matches project-header rows that have no component name', () => {
    const header = row({ componentName: undefined, ports: [3000, 8090] })
    expect(searchMatcher('bandai', header)).toBe(true)
    expect(searchMatcher('80', header)).toBe(true)
  })
})
