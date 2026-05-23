import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

/** Reads the favorites list from disk; returns [] when missing or corrupt. */
export function loadFavorites(favoritesPath: string): string[] {
  if (!existsSync(favoritesPath)) return []
  try {
    const parsed = JSON.parse(readFileSync(favoritesPath, 'utf-8'))
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/** Writes the favorites list, creating the parent directory if needed. */
export function saveFavorites(favoritesPath: string, favorites: string[]): void {
  const dir = dirname(favoritesPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(favoritesPath, JSON.stringify(favorites, null, 2), 'utf-8')
}

/** Returns a new list with `projectName` toggled. Pure. */
export function toggleFavorite(favorites: string[], projectName: string): string[] {
  return favorites.includes(projectName)
    ? favorites.filter((n) => n !== projectName)
    : [...favorites, projectName]
}

export function isFavorite(favorites: string[], projectName: string): boolean {
  return favorites.includes(projectName)
}
