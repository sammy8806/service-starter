import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const rendererPort = Number(process.env.ELECTRON_RENDERER_PORT ?? '5273')

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    server: {
      // Keep the renderer off Vite's default dev port and allow fallback if this one is busy.
      port: Number.isFinite(rendererPort) ? rendererPort : 5273,
      strictPort: false
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
