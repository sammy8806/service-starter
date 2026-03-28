import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/main/**/*.ts']
    }
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main')
    }
  }
})
