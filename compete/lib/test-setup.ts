/**
 * Test Setup for React Testing Library
 *
 * Configures the testing environment for React component tests.
 * Loaded automatically by vitest via setupFiles config.
 */

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Cleanup after each test to prevent test pollution
afterEach(() => {
  cleanup()
})

// Suppress React 18+ console warnings in tests
const originalError = console.error
console.error = (...args: unknown[]) => {
  // Filter out known React testing noise
  const message = String(args[0])
  if (
    message.includes('Warning: ReactDOM.render is no longer supported') ||
    message.includes('Warning: An update to') ||
    message.includes('act()')
  ) {
    return
  }
  originalError.apply(console, args)
}
