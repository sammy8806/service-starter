import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { EnvTab } from './EnvTab'

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getComponentEnv: vi.fn().mockResolvedValue({ NODE_ENV: 'development', PORT: '3000' })
  }
})

describe('EnvTab', () => {
  it('loads and renders resolved env vars', async () => {
    render(<EnvTab projectName="p" componentName="c" />)
    await waitFor(() => expect(screen.getByText('NODE_ENV')).toBeInTheDocument())
    expect(screen.getByText('development')).toBeInTheDocument()
    expect(window.api.getComponentEnv).toHaveBeenCalledWith('p', 'c')
  })

  it('shows an empty state when there are no env vars', async () => {
    ;(window.api.getComponentEnv as ReturnType<typeof vi.fn>).mockResolvedValue({})
    render(<EnvTab projectName="p" componentName="c" />)
    await waitFor(() => expect(screen.getByText(/no environment variables/i)).toBeInTheDocument())
  })
})
