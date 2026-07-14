import { describe, expect, it } from 'vitest'
import {
  resolvePortTemplate,
  templateReferencesPortLabel,
  validatePortLabels
} from './port-template'

const ports = [
  { port: 5173, label: 'frontend' },
  { port: 8000, label: 'api' }
]

describe('port-template', () => {
  describe('validatePortLabels', () => {
    it('accepts non-empty unique labels', () => {
      expect(validatePortLabels(ports)).toBeUndefined()
    })

    it('rejects empty labels', () => {
      expect(validatePortLabels([{ port: 1, label: '' }])).toMatch(/empty label/)
    })

    it('rejects duplicate labels', () => {
      expect(
        validatePortLabels([
          { port: 1, label: 'x' },
          { port: 2, label: 'x' }
        ])
      ).toMatch(/Duplicate port label: x/)
    })
  })

  describe('resolvePortTemplate', () => {
    it('resolves bare ${port} to the first declared port', () => {
      expect(resolvePortTemplate('vite --port ${port}', ports)).toEqual({
        resolved: 'vite --port 5173'
      })
    })

    it('resolves ${port.<label>} to the matching port', () => {
      expect(resolvePortTemplate('uvicorn --port ${port.api}', ports)).toEqual({
        resolved: 'uvicorn --port 8000'
      })
    })

    it('passes through text without placeholders unchanged', () => {
      expect(resolvePortTemplate('npm run dev', ports)).toEqual({ resolved: 'npm run dev' })
    })

    it('fails closed on an unknown label (placeholder left intact)', () => {
      const result = resolvePortTemplate('x ${port.nope}', ports)
      expect(result.error).toMatch(/Unknown port label: nope/)
      expect(result.resolved).toContain('${port.nope}')
    })

    it('fails closed on ${port} with no declared ports', () => {
      const result = resolvePortTemplate('x ${port}', [])
      expect(result.error).toMatch(/No ports declared/)
    })

    it('surfaces label-validation errors', () => {
      const result = resolvePortTemplate('x ${port}', [{ port: 1, label: '' }])
      expect(result.error).toMatch(/empty label/)
    })
  })

  describe('templateReferencesPortLabel', () => {
    it('is true when bare ${port} references the first declaration', () => {
      expect(templateReferencesPortLabel(['vite --port ${port}'], ports, 'frontend')).toBe(true)
    })

    it('is false when bare ${port} but label is not the first declaration', () => {
      expect(templateReferencesPortLabel(['vite --port ${port}'], ports, 'api')).toBe(false)
    })

    it('is true when ${port.<label>} references that label from env', () => {
      expect(templateReferencesPortLabel(['${port.api}'], ports, 'api')).toBe(true)
    })

    it('is false when no placeholder references the label', () => {
      expect(templateReferencesPortLabel(['npm run dev'], ports, 'frontend')).toBe(false)
    })
  })
})
