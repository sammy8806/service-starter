import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiStrip } from './KpiStrip'

describe('KpiStrip', () => {
  it('shows the running count', () => {
    render(<KpiStrip running={5} conflicts={0} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText(/running/)).toBeInTheDocument()
  })

  it('shows conflict count when > 0', () => {
    render(<KpiStrip running={3} conflicts={2} />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText(/conflicts/)).toBeInTheDocument()
  })

  it('hides conflict count when 0', () => {
    render(<KpiStrip running={3} conflicts={0} />)
    expect(screen.queryByText(/conflict/)).not.toBeInTheDocument()
  })
})
