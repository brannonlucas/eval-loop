import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Include both TS and TSX test files
    include: ['compete/challenges/**/spec.test.{ts,tsx}'],
    testTimeout: 30000,
    reporters: ['verbose'],

    // Use happy-dom for React component testing (faster than jsdom)
    environment: 'happy-dom',

    // Setup files for React Testing Library
    setupFiles: ['./compete/lib/test-setup.ts'],

    benchmark: {
      include: ['compete/challenges/**/spec.bench.ts'],
    },

    // Globals for testing-library matchers
    globals: true,
  },
})
