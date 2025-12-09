/**
 * Vitest Output Parser
 *
 * Parses vitest JSON output into structured test failure information.
 * Optimize this implementation for maximum performance!
 */

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
  stdout?: string
}

/**
 * Parse vitest JSON reporter output
 */
export function parseVitestJson(json: unknown): ParsedTestOutput {
  if (!json || typeof json !== 'object') {
    return {
      passed: false,
      numTests: 0,
      numPassed: 0,
      numFailed: 0,
      failures: [{ testName: 'parse', error: 'Invalid JSON input' }],
    }
  }

  const result = json as Record<string, unknown>

  const numTotalTests = typeof result.numTotalTests === 'number' ? result.numTotalTests : 0
  const numPassedTests = typeof result.numPassedTests === 'number' ? result.numPassedTests : 0
  const numFailedTests = typeof result.numFailedTests === 'number' ? result.numFailedTests : 0
  const success = result.success === true

  const failures: TestFailure[] = []

  if (Array.isArray(result.testResults)) {
    for (const testFile of result.testResults) {
      if (typeof testFile !== 'object' || !testFile) continue
      const file = testFile as Record<string, unknown>

      // Suite-level error
      if (file.status === 'failed' && typeof file.message === 'string') {
        const testName = typeof file.name === 'string' ? extractFileName(file.name) : 'unknown'
        failures.push({
          testName,
          error: file.message,
        })
      }

      // Individual assertion failures
      if (Array.isArray(file.assertionResults)) {
        for (const assertion of file.assertionResults) {
          if (typeof assertion !== 'object' || !assertion) continue
          const a = assertion as Record<string, unknown>

          if (a.status === 'failed') {
            const testName = typeof a.fullName === 'string' ? a.fullName : (typeof a.title === 'string' ? a.title : 'unknown')
            const failureMessages = Array.isArray(a.failureMessages) ? a.failureMessages : []
            const error = failureMessages.join('\n') || 'Test failed'

            const { expected, received } = extractExpectedReceived(error)

            failures.push({
              testName,
              error,
              expected,
              received,
            })
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
 * Parse vitest JSON from a string
 */
export function parseVitestJsonString(jsonString: string): ParsedTestOutput {
  try {
    const json = JSON.parse(jsonString)
    return parseVitestJson(json)
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

/**
 * Extract expected/received values from vitest error messages
 */
function extractExpectedReceived(error: string): { expected?: string; received?: string } {
  const expectedMatch = error.match(/Expected:\s*(.+?)(?:\n|$)/i)
  const receivedMatch = error.match(/Received:\s*(.+?)(?:\n|$)/i)

  if (expectedMatch || receivedMatch) {
    return {
      expected: expectedMatch?.[1]?.trim(),
      received: receivedMatch?.[1]?.trim(),
    }
  }

  const toBeMatch = error.match(/expected\s+(.+?)\s+to\s+(?:be|equal)\s+(.+?)(?:\s|$)/i)
  if (toBeMatch) {
    return {
      expected: toBeMatch[2]?.trim(),
      received: toBeMatch[1]?.trim(),
    }
  }

  return {}
}

/**
 * Extract filename from full path
 */
function extractFileName(fullPath: string): string {
  const parts = fullPath.split('/')
  return parts[parts.length - 1] || fullPath
}

/**
 * Parse raw vitest console output (fallback)
 */
export function parseVitestOutput(stdout: string): ParsedTestOutput | null {
  if (!stdout || typeof stdout !== 'string') {
    return null
  }

  const lines = stdout.split('\n')
  const failures: TestFailure[] = []
  let numPassed = 0
  let numFailed = 0

  const summaryMatch = stdout.match(/Tests\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed/i)
  if (summaryMatch) {
    numFailed = parseInt(summaryMatch[1], 10)
    numPassed = parseInt(summaryMatch[2], 10)
  }

  let currentTest: string | null = null
  let currentError: string[] = []

  for (const line of lines) {
    const failedTestMatch = line.match(/[✕×]\s+(.+?)(?:\s+\(\d+\s*ms\))?$/)
    if (failedTestMatch) {
      if (currentTest && currentError.length > 0) {
        failures.push({
          testName: currentTest,
          error: currentError.join('\n').trim(),
        })
      }
      currentTest = failedTestMatch[1].trim()
      currentError = []
      continue
    }

    if (currentTest) {
      if (line.match(/^[✓✕×]\s+/) || line.match(/^Tests\s+/)) {
        if (currentError.length > 0) {
          failures.push({
            testName: currentTest,
            error: currentError.join('\n').trim(),
          })
        }
        currentTest = null
        currentError = []
      } else if (line.trim()) {
        currentError.push(line)
      }
    }
  }

  if (currentTest && currentError.length > 0) {
    failures.push({
      testName: currentTest,
      error: currentError.join('\n').trim(),
    })
  }

  if (numPassed > 0 || numFailed > 0 || failures.length > 0) {
    return {
      passed: numFailed === 0,
      numTests: numPassed + numFailed,
      numPassed,
      numFailed,
      failures,
      stdout,
    }
  }

  return null
}
