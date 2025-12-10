/**
 * Vitest Output Parser (Optimized)
 *
 * Parses vitest JSON output into structured test failure information
 * for the /api/jobs/:id/debug endpoint.
 *
 * Optimized for performance using indexOf/substring instead of regex
 * where possible, and avoiding split() for line-by-line processing.
 */

import { basename } from 'path'

export interface TestFailure {
  testName: string
  error: string
  expected?: string
  received?: string
}

export interface ParsedTestOutput {
  passed: boolean
  numTests: number
  numPassed: number
  numFailed: number
  failures: TestFailure[]
}

const ERROR_RESULT: ParsedTestOutput = {
  passed: false,
  numTests: 0,
  numPassed: 0,
  numFailed: 0,
  failures: [{ testName: 'parse', error: 'Invalid JSON input' }],
}

/**
 * Extract expected/received values from vitest error messages
 *
 * Uses indexOf/substring for performance instead of regex.
 * Common patterns:
 * - "Expected: X\nReceived: Y"
 * - "expected X to be Y" or "expected X to equal Y"
 */
function extractExpectedReceived(msg: string): { expected?: string; received?: string } {
  let expected: string | undefined
  let received: string | undefined

  // Pattern 1: "Expected: X" / "Received: Y" on separate lines (case-insensitive)
  let idx = msg.indexOf('Expected:')
  if (idx === -1) idx = msg.indexOf('expected:')
  if (idx === -1) idx = msg.indexOf('EXPECTED:')
  if (idx !== -1) {
    const start = idx + 9
    let end = msg.indexOf('\n', start)
    if (end === -1) end = msg.length
    expected = msg.substring(start, end).trim()
  }

  idx = msg.indexOf('Received:')
  if (idx === -1) idx = msg.indexOf('received:')
  if (idx === -1) idx = msg.indexOf('RECEIVED:')
  if (idx !== -1) {
    const start = idx + 9
    let end = msg.indexOf('\n', start)
    if (end === -1) end = msg.length
    received = msg.substring(start, end).trim()
  }

  if (expected !== undefined || received !== undefined) {
    return { expected, received }
  }

  // Pattern 2: "expected X to be Y" or "expected X to equal Y"
  idx = msg.indexOf('expected ')
  if (idx !== -1) {
    const afterExpected = idx + 9
    const toBeIdx = msg.indexOf(' to be ', afterExpected)
    const toEqualIdx = msg.indexOf(' to equal ', afterExpected)

    if (toBeIdx !== -1 && (toEqualIdx === -1 || toBeIdx < toEqualIdx)) {
      received = msg.substring(afterExpected, toBeIdx).trim()
      let end = msg.indexOf('\n', toBeIdx + 7)
      if (end === -1) end = msg.length
      // Handle end of string - trim whitespace and trailing punctuation
      let exp = msg.substring(toBeIdx + 7, end).trim()
      // Remove trailing period/comma if present
      if (exp.endsWith('.') || exp.endsWith(',')) {
        exp = exp.slice(0, -1)
      }
      expected = exp
      return { expected, received }
    }

    if (toEqualIdx !== -1) {
      received = msg.substring(afterExpected, toEqualIdx).trim()
      let end = msg.indexOf('\n', toEqualIdx + 10)
      if (end === -1) end = msg.length
      let exp = msg.substring(toEqualIdx + 10, end).trim()
      if (exp.endsWith('.') || exp.endsWith(',')) {
        exp = exp.slice(0, -1)
      }
      expected = exp
      return { expected, received }
    }
  }

  return {}
}


/**
 * Parse vitest JSON reporter output
 *
 * Vitest JSON format includes:
 * - numTotalTests, numPassedTests, numFailedTests
 * - testResults[].assertionResults[] for individual test results
 * - testResults[].message for suite-level errors (like import failures)
 */
export function parseVitestJson(json: unknown): ParsedTestOutput {
  if (!json || typeof json !== 'object') {
    return ERROR_RESULT
  }

  const result = json as Record<string, unknown>

  const numTotalTests = typeof result.numTotalTests === 'number' ? result.numTotalTests : 0
  const numPassedTests = typeof result.numPassedTests === 'number' ? result.numPassedTests : 0
  const numFailedTests = typeof result.numFailedTests === 'number' ? result.numFailedTests : 0
  const success = result.success === true

  const failures: TestFailure[] = []

  // Extract failures from testResults
  if (Array.isArray(result.testResults)) {
    for (let i = 0, len = result.testResults.length; i < len; i++) {
      const testFile = result.testResults[i]
      if (typeof testFile !== 'object' || !testFile) continue
      const file = testFile as Record<string, unknown>

      // Suite-level error (e.g., import failure)
      if (file.status === 'failed' && typeof file.message === 'string') {
        const testName = typeof file.name === 'string' ? basename(file.name) : 'unknown'
        const extracted = extractExpectedReceived(file.message)
        const failure: TestFailure = { testName, error: file.message }
        if (extracted.expected !== undefined) failure.expected = extracted.expected
        if (extracted.received !== undefined) failure.received = extracted.received
        failures.push(failure)
      }

      // Individual assertion failures
      if (Array.isArray(file.assertionResults)) {
        for (let j = 0, alen = file.assertionResults.length; j < alen; j++) {
          const assertion = file.assertionResults[j]
          if (typeof assertion !== 'object' || !assertion) continue
          const a = assertion as Record<string, unknown>

          if (a.status === 'failed') {
            const testName =
              typeof a.fullName === 'string'
                ? a.fullName
                : typeof a.title === 'string'
                  ? a.title
                  : 'unknown'

            let error = 'Test failed'
            const failureMessages = a.failureMessages
            if (Array.isArray(failureMessages) && failureMessages.length > 0) {
              const msgs: string[] = []
              for (let k = 0; k < failureMessages.length; k++) {
                if (typeof failureMessages[k] === 'string') {
                  msgs.push(failureMessages[k])
                }
              }
              if (msgs.length > 0) error = msgs.join('\n')
            }

            const extracted = extractExpectedReceived(error)
            const failure: TestFailure = { testName, error }
            if (extracted.expected !== undefined) failure.expected = extracted.expected
            if (extracted.received !== undefined) failure.received = extracted.received
            failures.push(failure)
          }
        }
      }
    }
  }

  return {
    passed: success,
    numTests: numTotalTests,
    numPassed: numPassedTests,
    numFailed: numFailedTests,
    failures,
  }
}

/**
 * Parse vitest JSON from a string (handles potential JSON parsing errors)
 */
export function parseVitestJsonString(jsonString: string): ParsedTestOutput {
  try {
    return parseVitestJson(JSON.parse(jsonString))
  } catch {
    return {
      passed: false,
      numTests: 0,
      numPassed: 0,
      numFailed: 0,
      failures: [{ testName: 'parse', error: `Failed to parse JSON: ${jsonString.slice(0, 200)}` }],
    }
  }
}

