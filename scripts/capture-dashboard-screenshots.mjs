#!/usr/bin/env node
/**
 * Capture dashboard screenshots for documentation.
 * Requires: npx electron-vite build
 */
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'docs', 'screenshots')
const RENDERER_DIR = join(ROOT, 'out', 'renderer')
const PORT = 5273
const BASE = `http://127.0.0.1:${PORT}`

const SHOTS = [
  { name: 'dashboard-overview', hash: '#dashboard' },
  { name: 'dashboard-project', hash: '#dashboard/project/shop-platform' },
  { name: 'dashboard-component-logs', hash: '#dashboard/component/shop-platform/backend' },
  { name: 'dashboard-settings', hash: '#dashboard/settings' }
]

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`)
}

function runStaticServer() {
  return spawn('npx', ['serve', RENDERER_DIR, '-l', String(PORT), '--no-clipboard'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const server = runStaticServer()
  server.stdout?.on('data', (d) => process.stdout.write(d))
  server.stderr?.on('data', (d) => process.stderr.write(d))

  try {
    await waitForServer(BASE)
    const { chromium } = await import('playwright')

    const browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 900, height: 670 } })

    for (const shot of SHOTS) {
      await page.goto(`${BASE}/?preview=1${shot.hash}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(600)
      await page.screenshot({ path: join(OUT_DIR, `${shot.name}.png`), fullPage: false })
      console.log(`Captured ${shot.name}.png`)
    }

    await browser.close()
  } finally {
    server.kill('SIGTERM')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
