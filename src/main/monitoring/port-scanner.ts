import { execFile } from 'child_process'
import { ActivePort } from '../config/types'

/**
 * Runs `lsof -iTCP -sTCP:LISTEN -P -n` and parses output into ActivePort entries.
 * Only works on macOS/Linux.
 */
export function scanActivePorts(): Promise<ActivePort[]> {
  return new Promise((resolve) => {
    execFile('lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n', '-F', 'pcn'], (error, stdout) => {
      if (error || !stdout) {
        // lsof may fail if no listening ports or permission issues
        resolve([])
        return
      }

      resolve(parseLsofFOutput(stdout))
    })
  })
}

/**
 * Parses lsof -F pcn output format.
 * Fields: p=PID, c=command, n=name (contains :port)
 */
export function parseLsofFOutput(output: string): ActivePort[] {
  const ports: ActivePort[] = []
  let currentPid = 0
  let currentProcess = ''

  for (const line of output.split('\n')) {
    if (!line) continue

    const type = line[0]
    const value = line.slice(1)

    switch (type) {
      case 'p':
        currentPid = parseInt(value, 10)
        break
      case 'c':
        currentProcess = value
        break
      case 'n': {
        // Format: *:PORT or 127.0.0.1:PORT or [::1]:PORT
        const portMatch = value.match(/:(\d+)$/)
        if (portMatch) {
          const port = parseInt(portMatch[1], 10)
          // Avoid duplicates (lsof may list same port on different interfaces)
          if (!ports.some((p) => p.port === port && p.pid === currentPid)) {
            ports.push({ port, pid: currentPid, process: currentProcess })
          }
        }
        break
      }
    }
  }

  return ports
}

/**
 * Alternative parser for standard lsof output (non -F format).
 * Parses `lsof -iTCP -sTCP:LISTEN -P -n` default output.
 */
export function parseLsofStandardOutput(output: string): ActivePort[] {
  const ports: ActivePort[] = []
  const lines = output.split('\n').slice(1) // Skip header

  for (const line of lines) {
    if (!line.trim()) continue

    const parts = line.split(/\s+/)
    if (parts.length < 9) continue

    const process = parts[0]
    const pid = parseInt(parts[1], 10)
    const nameField = parts[8] // e.g., *:3000 or 127.0.0.1:8080

    const portMatch = nameField.match(/:(\d+)$/)
    if (portMatch) {
      const port = parseInt(portMatch[1], 10)
      if (!ports.some((p) => p.port === port && p.pid === pid)) {
        ports.push({ port, pid, process })
      }
    }
  }

  return ports
}
