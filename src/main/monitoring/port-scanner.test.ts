import { describe, it, expect } from 'vitest'
import { parseLsofFOutput, parseLsofStandardOutput } from './port-scanner'

describe('port-scanner', () => {
  describe('parseLsofFOutput', () => {
    it('parses typical lsof -F pcn output', () => {
      const output = [
        'p1234',
        'cnode',
        'n*:3000',
        'p5678',
        'cpython3',
        'n127.0.0.1:8080',
        ''
      ].join('\n')

      const ports = parseLsofFOutput(output)

      expect(ports).toEqual([
        { port: 3000, pid: 1234, process: 'node' },
        { port: 8080, pid: 5678, process: 'python3' }
      ])
    })

    it('handles IPv6 addresses', () => {
      const output = ['p1234', 'cnode', 'n[::1]:3000', ''].join('\n')

      const ports = parseLsofFOutput(output)
      expect(ports).toEqual([{ port: 3000, pid: 1234, process: 'node' }])
    })

    it('deduplicates same port+pid on different interfaces', () => {
      const output = [
        'p1234',
        'cnode',
        'n*:3000',
        'n127.0.0.1:3000',
        'n[::1]:3000',
        ''
      ].join('\n')

      const ports = parseLsofFOutput(output)
      expect(ports).toHaveLength(1)
      expect(ports[0]).toEqual({ port: 3000, pid: 1234, process: 'node' })
    })

    it('returns empty array for empty output', () => {
      expect(parseLsofFOutput('')).toEqual([])
    })

    it('handles multiple processes on different ports', () => {
      const output = [
        'p100',
        'cnginx',
        'n*:80',
        'n*:443',
        'p200',
        'cnode',
        'n*:3000',
        ''
      ].join('\n')

      const ports = parseLsofFOutput(output)
      expect(ports).toHaveLength(3)
      expect(ports).toEqual([
        { port: 80, pid: 100, process: 'nginx' },
        { port: 443, pid: 100, process: 'nginx' },
        { port: 3000, pid: 200, process: 'node' }
      ])
    })
  })

  describe('parseLsofStandardOutput', () => {
    it('parses standard lsof output', () => {
      const output = [
        'COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME',
        'node    1234 user   22u  IPv4 0x1234      0t0  TCP *:3000 (LISTEN)',
        'python3 5678 user   3u   IPv4 0x5678      0t0  TCP 127.0.0.1:8080 (LISTEN)',
        ''
      ].join('\n')

      const ports = parseLsofStandardOutput(output)
      expect(ports).toEqual([
        { port: 3000, pid: 1234, process: 'node' },
        { port: 8080, pid: 5678, process: 'python3' }
      ])
    })

    it('returns empty for empty output', () => {
      expect(parseLsofStandardOutput('')).toEqual([])
    })
  })
})
