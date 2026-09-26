import { defineConfig } from 'vitest/config'

// Tests cover pure domain and application functions only: Node environment, no React plugin, no Supabase.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
