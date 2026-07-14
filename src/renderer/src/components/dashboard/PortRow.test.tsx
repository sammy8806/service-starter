import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PatchbayPortRow } from '../../utils/patchbayRows'
import { PortRow } from './PortRow'

const contested: PatchbayPortRow = {
  port: 5173,
  kind: 'contested',
  externalHolder: false,
  claimants: [
    {
      projectName: 'auto',
      componentName: 'frontend',
      label: 'frontend',
      status: 'stopped',
      processOrigin: 'none',
      isHolder: false
    },
    {
      projectName: 'fmh',
      componentName: 'frontend',
      label: 'frontend',
      status: 'stopped',
      processOrigin: 'none',
      isHolder: false
    }
  ]
}

const held: PatchbayPortRow = {
  port: 8090,
  kind: 'held',
  externalHolder: false,
  holderPid: 51002,
  holderProcess: 'java',
  claimants: [
    {
      projectName: 'bandai',
      componentName: 'backend',
      label: 'http',
      status: 'running',
      processOrigin: 'managed',
      isHolder: true,
      pid: 51002,
      process: 'java'
    },
    {
      projectName: 'fmh',
      componentName: 'ocr',
      label: 'http',
      status: 'stopped',
      processOrigin: 'none',
      isHolder: false
    }
  ]
}

const noop = { onRun: () => {}, onStop: () => {} }

describe('PortRow', () => {
  it('runs an idle single claimant', () => {
    const onRun = vi.fn()
    render(
      <PortRow
        row={{
          port: 3000,
          kind: 'idle',
          externalHolder: false,
          claimants: [
            {
              projectName: 'bandai',
              componentName: 'web',
              label: 'web',
              status: 'stopped',
              processOrigin: 'none',
              isHolder: false
            }
          ]
        }}
        allRows={[]}
        onReassign={async () => ({ ok: true })}
        onStop={() => {}}
        onRun={onRun}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /run/i }))
    expect(onRun).toHaveBeenCalledWith('bandai', 'web')
  })

  it('applies a reassign for the chosen non-holder claimant', async () => {
    const onReassign = vi.fn().mockResolvedValue({ ok: true })
    render(<PortRow row={contested} allRows={[contested]} onReassign={onReassign} {...noop} />)
    fireEvent.click(screen.getByRole('button', { name: /reassign/i }))
    fireEvent.click(screen.getByText('fmh / frontend'))
    fireEvent.click(screen.getByRole('button', { name: /apply/i }))
    await waitFor(() =>
      expect(onReassign).toHaveBeenCalledWith('fmh', 'frontend', 'frontend', 5173, 5174)
    )
  })

  it('keeps the picker open and shows the error on failure', async () => {
    const onReassign = vi.fn().mockResolvedValue({
      ok: false,
      code: 'missing-template',
      message: 'Wire ${port} first'
    })
    render(<PortRow row={contested} allRows={[contested]} onReassign={onReassign} {...noop} />)
    fireEvent.click(screen.getByRole('button', { name: /reassign/i }))
    fireEvent.click(screen.getByText('auto / frontend'))
    fireEvent.click(screen.getByRole('button', { name: /apply/i }))
    expect(await screen.findByText(/Wire \$\{port\} first/)).toBeInTheDocument()
    expect(screen.getByText(/Which one moves off/)).toBeInTheDocument()
  })

  it('disables the holder claimant in the picker', () => {
    render(
      <PortRow row={held} allRows={[held]} onReassign={async () => ({ ok: true })} {...noop} />
    )
    fireEvent.click(screen.getByRole('button', { name: /reassign/i }))
    expect(screen.getByText('bandai / backend').closest('button')).toBeDisabled()
  })

  it('uses a suggested port after a failed apply', async () => {
    const onReassign = vi.fn().mockResolvedValue({
      ok: false,
      code: 'occupied-destination',
      message: 'Port is occupied',
      suggestedPort: 5180
    })
    render(<PortRow row={contested} allRows={[contested]} onReassign={onReassign} {...noop} />)
    fireEvent.click(screen.getByRole('button', { name: /reassign/i }))
    fireEvent.click(screen.getByRole('button', { name: /apply/i }))
    await screen.findByText('Port is occupied')
    expect(screen.getByLabelText('New port')).toHaveValue(5180)
  })
})
