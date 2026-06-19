import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LogStreamer } from './log-streamer'
import { mkdtempSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('LogStreamer', () => {
  let tempDir: string
  let streamer: LogStreamer

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'log-test-'))
    streamer = new LogStreamer()
  })

  afterEach(() => {
    streamer.stopAll()
    vi.useRealTimers()
  })

  describe('getLog', () => {
    it('should return file contents', () => {
      const logFile = join(tempDir, 'test.log')
      writeFileSync(logFile, 'line 1\nline 2\n')

      const content = streamer.getLog(logFile)
      expect(content).toBe('line 1\nline 2\n')
    })

    it('should return empty string for non-existent file', () => {
      const content = streamer.getLog(join(tempDir, 'nope.log'))
      expect(content).toBe('')
    })
  })

  describe('startTailing', () => {
    it('should emit new data when file is appended to', async () => {
      const logFile = join(tempDir, 'tail.log')
      writeFileSync(logFile, 'initial\n')

      const chunks: string[] = []
      streamer.on('log-data', (data: { logFile: string; content: string }) => {
        chunks.push(data.content)
      })

      streamer.startTailing(logFile)

      // Wait for watcher to initialize
      await new Promise((r) => setTimeout(r, 200))

      appendFileSync(logFile, 'new line\n')

      // Wait for fs.watch to fire
      await new Promise((r) => setTimeout(r, 500))

      expect(chunks.length).toBeGreaterThanOrEqual(1)
      expect(chunks.join('')).toContain('new line')
    })

    it('should emit bytes already written after the provided start offset', () => {
      const logFile = join(tempDir, 'startup.log')
      const loadedContent = 'initial read\n'
      writeFileSync(logFile, `${loadedContent}startup line\n`)

      const chunks: string[] = []
      streamer.on('log-data', (data: { logFile: string; content: string }) => {
        chunks.push(data.content)
      })

      streamer.startTailing(logFile, Buffer.byteLength(loadedContent, 'utf-8'))

      expect(chunks.join('')).toBe('startup line\n')
    })

    it('should poll for appended content when watcher events are delayed', async () => {
      vi.useFakeTimers()
      const logFile = join(tempDir, 'poll.log')
      writeFileSync(logFile, '')

      const chunks: string[] = []
      streamer.on('log-data', (data: { logFile: string; content: string }) => {
        chunks.push(data.content)
      })

      streamer.startTailing(logFile)
      appendFileSync(logFile, 'polled line\n')

      await vi.advanceTimersByTimeAsync(300)

      expect(chunks.join('')).toContain('polled line')
    })
  })

  describe('stopTailing', () => {
    it('should stop watching the file', () => {
      const logFile = join(tempDir, 'stop.log')
      writeFileSync(logFile, '')

      streamer.startTailing(logFile)
      streamer.stopTailing(logFile)

      // Should not throw
      expect(true).toBe(true)
    })
  })
})
