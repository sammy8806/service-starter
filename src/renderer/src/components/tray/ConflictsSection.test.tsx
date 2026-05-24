import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConflictsSection } from './ConflictsSection'
import { ConflictRow } from '../../utils/sortServices'

const rows: ConflictRow[] = [
  { port: 3001, claimants: ['bandai/docs'], primaryLabel: 'bandai/docs', activePid: 42 }
]

describe('ConflictsSection', () => {
  it('renders nothing when there are no conflicts', () => {
    const { container } = render(
      <ConflictsSection conflicts={[]} selectedId={null} onKillPort={vi.fn()} onShowMenu={vi.fn()} onHover={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a header count and dispatches kill', async () => {
    const onKillPort = vi.fn()
    render(
      <ConflictsSection conflicts={rows} selectedId={null} onKillPort={onKillPort} onShowMenu={vi.fn()} onHover={vi.fn()} />
    )
    expect(screen.getByText(/CONFLICTS \(1\)/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /kill :3001/i }))
    expect(onKillPort).toHaveBeenCalledWith(3001)
  })
})
