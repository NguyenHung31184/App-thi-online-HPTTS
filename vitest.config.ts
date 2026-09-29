import { defineConfig } from 'vitest/config'

// Database tests use an isolated PGlite instance; no production credentials are needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'tests/**/*.test.ts'],
    hookTimeout: 30000,
  },
})
