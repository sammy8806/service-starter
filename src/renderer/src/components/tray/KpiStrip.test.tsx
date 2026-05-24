import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiStrip } from './KpiStrip'

describe('KpiStrip', () => {
  it('shows the running count', () => {
    render(<KpiStrip running={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText(/running/)).toBeInTheDocument()
  })

  it('shows 0 running when nothing is running', () => {
    render(<KpiStrip running={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
