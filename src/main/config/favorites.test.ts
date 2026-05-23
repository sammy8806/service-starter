import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadFavorites, saveFavorites, toggleFavorite, isFavorite } from './favorites'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('favorites', () => {
  let dir: string
  let path: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fav-test-'))
    path = join(dir, 'favorites.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns an empty list when the file does not exist', () => {
    expect(loadFavorites(path)).toEqual([])
  })

  it('round-trips through save/load', () => {
    saveFavorites(path, ['bandai', 'mflow'])
    expect(loadFavorites(path)).toEqual(['bandai', 'mflow'])
  })

  it('returns an empty list for a corrupt file', () => {
    writeFileSync(path, '{ not json', 'utf-8')
    expect(loadFavorites(path)).toEqual([])
  })

  it('toggle adds when absent and removes when present (pure)', () => {
    expect(toggleFavorite([], 'a')).toEqual(['a'])
    expect(toggleFavorite(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('isFavorite reflects membership', () => {
    expect(isFavorite(['a'], 'a')).toBe(true)
    expect(isFavorite(['a'], 'b')).toBe(false)
  })
})
