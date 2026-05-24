import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FooterActions } from './FooterActions'

describe('FooterActions', () => {
  it('renders the port/project summary', () => {
    render(<FooterActions activePorts={5} totalPorts={9} projectCount={3} onShowMenu={vi.fn()} />)
    expect(screen.getByText(/5\/9 ports/)).toBeInTheDocument()
    expect(screen.getByText(/3 projects/)).toBeInTheDocument()
  })

  it('opens the footer menu on the overflow button', async () => {
    const onShowMenu = vi.fn()
    render(<FooterActions activePorts={0} totalPorts={0} projectCount={0} onShowMenu={onShowMenu} />)
    await userEvent.click(screen.getByRole('button', { name: /more/i }))
    expect(onShowMenu).toHaveBeenCalled()
  })
})
