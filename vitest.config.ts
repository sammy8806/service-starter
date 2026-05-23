import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/main/**/*.ts']
    },
    projects: [
      {
        extends: true,
        test: {
          name: { label: 'node', color: 'green' },
          environment: 'node',
          include: ['src/**/*.test.ts']
        }
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: { label: 'dom', color: 'magenta' },
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.tsx'],
          setupFiles: ['./vitest.setup.ts']
        }
      }
    ]
  }
})
