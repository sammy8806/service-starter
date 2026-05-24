import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from './SearchBar'

describe('SearchBar', () => {
  it('reports typed input through onChange', async () => {
    const onChange = vi.fn()
    render(<SearchBar value="" onChange={onChange} onFocusChange={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('Search…'), 'api')
    expect(onChange).toHaveBeenLastCalledWith('api')
  })

  it('clears the query on Escape when non-empty', async () => {
    const onChange = vi.fn()
    render(<SearchBar value="api" onChange={onChange} onFocusChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Search…')
    input.focus()
    await userEvent.keyboard('{Escape}')
    expect(onChange).toHaveBeenCalledWith('')
  })
})
