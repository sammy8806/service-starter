import { describe, it, expect } from 'vitest'
import { resolveEnvVars, checkRequiredEnvVars } from './env-resolver'

describe('env-resolver', () => {
  describe('resolveEnvVars', () => {
    it('resolves present env vars', () => {
      const env = { API_KEY: '${MY_KEY}' }
      const processEnv = { MY_KEY: 'secret123' }

      const result = resolveEnvVars(env, processEnv)

      expect(result.resolved).toEqual({ API_KEY: 'secret123' })
      expect(result.missing).toEqual([])
    })

    it('reports missing env vars', () => {
      const env = { API_KEY: '${MY_KEY}' }
      const processEnv = {}

      const result = resolveEnvVars(env, processEnv)

      expect(result.resolved).toEqual({ API_KEY: '${MY_KEY}' })
      expect(result.missing).toEqual(['MY_KEY'])
    })

    it('handles values without env var references', () => {
      const env = { NODE_ENV: 'development' }

      const result = resolveEnvVars(env, {})

      expect(result.resolved).toEqual({ NODE_ENV: 'development' })
      expect(result.missing).toEqual([])
    })

    it('resolves multiple vars in a single value', () => {
      const env = { URL: '${PROTOCOL}://${HOST}:${PORT}' }
      const processEnv = { PROTOCOL: 'https', HOST: 'localhost', PORT: '3000' }

      const result = resolveEnvVars(env, processEnv)

      expect(result.resolved).toEqual({ URL: 'https://localhost:3000' })
      expect(result.missing).toEqual([])
    })

    it('reports each missing var only once', () => {
      const env = {
        A: '${MISSING}',
        B: '${MISSING}'
      }

      const result = resolveEnvVars(env, {})

      expect(result.missing).toEqual(['MISSING'])
    })

    it('handles mixed present and missing vars', () => {
      const env = { URL: '${HOST}:${PORT}' }
      const processEnv = { HOST: 'localhost' }

      const result = resolveEnvVars(env, processEnv)

      expect(result.resolved).toEqual({ URL: 'localhost:${PORT}' })
      expect(result.missing).toEqual(['PORT'])
    })

    it('handles empty env object', () => {
      const result = resolveEnvVars({}, {})

      expect(result.resolved).toEqual({})
      expect(result.missing).toEqual([])
    })
  })

  describe('checkRequiredEnvVars', () => {
    it('returns empty array when all vars present', () => {
      const missing = checkRequiredEnvVars(['KEY1', 'KEY2'], { KEY1: 'a', KEY2: 'b' })
      expect(missing).toEqual([])
    })

    it('returns missing var names', () => {
      const missing = checkRequiredEnvVars(['KEY1', 'KEY2'], { KEY1: 'a' })
      expect(missing).toEqual(['KEY2'])
    })

    it('handles empty required list', () => {
      const missing = checkRequiredEnvVars([], {})
      expect(missing).toEqual([])
    })
  })
})
