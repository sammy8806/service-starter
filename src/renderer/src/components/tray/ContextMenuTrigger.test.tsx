import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContextMenuTrigger } from './ContextMenuTrigger'

describe('ContextMenuTrigger', () => {
  it('fires onShow when the overflow button is clicked', async () => {
    const onShow = vi.fn()
    render(<ContextMenuTrigger onShow={onShow} label="More for api" />)
    await userEvent.click(screen.getByRole('button', { name: 'More for api' }))
    expect(onShow).toHaveBeenCalledTimes(1)
  })

  it('fires onShow on right-click of its wrapped children', async () => {
    const onShow = vi.fn()
    render(
      <ContextMenuTrigger onShow={onShow} label="More">
        <div>row body</div>
      </ContextMenuTrigger>
    )
    const body = screen.getByText('row body')
    body.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    expect(onShow).toHaveBeenCalledTimes(1)
  })
})
