import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsView } from './SettingsView'

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getConfig: vi.fn().mockResolvedValue({
      scanDirectories: ['~/work'],
      scanIntervalMs: 5000,
      portScanIntervalMs: 3000,
      editor: 'code',
      terminal: 'default',
      gitGui: 'fork'
    }),
    saveConfig: vi.fn().mockResolvedValue(true),
    selectDirectory: vi.fn().mockResolvedValue('/Users/me/projects')
  }
})

describe('SettingsView', () => {
  it('disables Save until a change is made', async () => {
    render(<SettingsView />)
    await waitFor(() => expect(screen.getByText('~/work')).toBeInTheDocument())
    const save = screen.getByRole('button', { name: /save/i })
    expect(save).toBeDisabled()
  })

  it('adds a directory via the native folder picker and enables Save', async () => {
    render(<SettingsView />)
    await waitFor(() => expect(screen.getByText('~/work')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /add directory/i }))
    await waitFor(() => expect(screen.getByText('/Users/me/projects')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled()
  })
})
