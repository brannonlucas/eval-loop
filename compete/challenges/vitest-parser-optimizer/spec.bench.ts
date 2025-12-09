import { describe, bench } from 'vitest'
import { parseVitestJson, parseVitestJsonString, parseVitestOutput } from './solution'

/**
 * Generate realistic vitest JSON output with N test results
 */
function generateVitestJson(numTests: number, failureRate = 0.1) {
  const numFailed = Math.floor(numTests * failureRate)
  const numPassed = numTests - numFailed

  const assertionResults = []
  for (let i = 0; i < numTests; i++) {
    const isFailed = i < numFailed
    assertionResults.push({
      status: isFailed ? 'failed' : 'passed',
      fullName: `test suite > nested describe > test case ${i}`,
      title: `test case ${i}`,
      failureMessages: isFailed
        ? [`Expected: ${i * 2}\nReceived: ${i * 2 + 1}\n\nExpected value to be ${i * 2} but received ${i * 2 + 1}`]
        : [],
    })
  }

  return {
    success: numFailed === 0,
    numTotalTests: numTests,
    numPassedTests: numPassed,
    numFailedTests: numFailed,
    testResults: [
      {
        name: '/path/to/project/src/__tests__/component.test.ts',
        status: numFailed > 0 ? 'failed' : 'passed',
        assertionResults,
      },
    ],
  }
}

/**
 * Generate vitest JSON spread across multiple test files
 */
function generateMultiFileVitestJson(numFiles: number, testsPerFile: number, failureRate = 0.1) {
  const totalTests = numFiles * testsPerFile
  const totalFailed = Math.floor(totalTests * failureRate)
  let failuresAssigned = 0

  const testResults = []
  for (let f = 0; f < numFiles; f++) {
    const assertionResults = []
    for (let t = 0; t < testsPerFile; t++) {
      const isFailed = failuresAssigned < totalFailed && Math.random() < failureRate * 2
      if (isFailed) failuresAssigned++

      assertionResults.push({
        status: isFailed ? 'failed' : 'passed',
        fullName: `file${f} > describe > test ${t}`,
        title: `test ${t}`,
        failureMessages: isFailed
          ? [`Expected: "value${t}"\nReceived: "other${t}"`]
          : [],
      })
    }

    testResults.push({
      name: `/path/to/project/src/__tests__/file${f}.test.ts`,
      status: assertionResults.some((a) => a.status === 'failed') ? 'failed' : 'passed',
      assertionResults,
    })
  }

  return {
    success: failuresAssigned === 0,
    numTotalTests: totalTests,
    numPassedTests: totalTests - failuresAssigned,
    numFailedTests: failuresAssigned,
    testResults,
  }
}

/**
 * Generate raw vitest console output with N failed tests
 */
function generateVitestConsoleOutput(numFailed: number, numPassed: number) {
  const lines: string[] = []

  // Add failed test output
  for (let i = 0; i < numFailed; i++) {
    lines.push(` ✕ test case ${i} should do something specific (${Math.floor(Math.random() * 100)} ms)`)
    lines.push(`    Expected: ${i * 10}`)
    lines.push(`    Received: ${i * 10 + 1}`)
    lines.push('')
  }

  // Add passed test markers
  for (let i = 0; i < numPassed; i++) {
    lines.push(` ✓ passing test ${i} (${Math.floor(Math.random() * 10)} ms)`)
  }

  // Summary line
  lines.push('')
  lines.push(` Tests  ${numFailed} failed | ${numPassed} passed`)

  return lines.join('\n')
}

// Pre-generate test data to avoid generation time in benchmarks
const smallJson = generateVitestJson(10)
const mediumJson = generateVitestJson(100)
const largeJson = generateVitestJson(1000)
const multiFileJson = generateMultiFileVitestJson(50, 20) // 1000 tests across 50 files

const smallJsonString = JSON.stringify(smallJson)
const mediumJsonString = JSON.stringify(mediumJson)
const largeJsonString = JSON.stringify(largeJson)

const smallConsoleOutput = generateVitestConsoleOutput(2, 8)
const mediumConsoleOutput = generateVitestConsoleOutput(20, 80)
const largeConsoleOutput = generateVitestConsoleOutput(100, 400)

// All passing (common case optimization opportunity)
const allPassingJson = generateVitestJson(100, 0)
const allPassingJsonString = JSON.stringify(allPassingJson)

// All failing (worst case)
const allFailingJson = generateVitestJson(100, 1.0)
const allFailingJsonString = JSON.stringify(allFailingJson)

describe('parseVitestJson - Performance', () => {
  bench('parse small JSON (10 tests)', () => {
    parseVitestJson(smallJson)
  })

  bench('parse medium JSON (100 tests)', () => {
    parseVitestJson(mediumJson)
  })

  bench('parse large JSON (1000 tests)', () => {
    parseVitestJson(largeJson)
  })

  bench('parse multi-file JSON (50 files, 1000 tests)', () => {
    parseVitestJson(multiFileJson)
  })

  bench('parse all passing (100 tests)', () => {
    parseVitestJson(allPassingJson)
  })

  bench('parse all failing (100 tests)', () => {
    parseVitestJson(allFailingJson)
  })
})

describe('parseVitestJsonString - Performance', () => {
  bench('parse small JSON string (10 tests)', () => {
    parseVitestJsonString(smallJsonString)
  })

  bench('parse medium JSON string (100 tests)', () => {
    parseVitestJsonString(mediumJsonString)
  })

  bench('parse large JSON string (1000 tests)', () => {
    parseVitestJsonString(largeJsonString)
  })

  bench('parse all passing JSON string', () => {
    parseVitestJsonString(allPassingJsonString)
  })

  bench('parse all failing JSON string', () => {
    parseVitestJsonString(allFailingJsonString)
  })
})

describe('parseVitestOutput - Performance', () => {
  bench('parse small console output (10 tests)', () => {
    parseVitestOutput(smallConsoleOutput)
  })

  bench('parse medium console output (100 tests)', () => {
    parseVitestOutput(mediumConsoleOutput)
  })

  bench('parse large console output (500 tests)', () => {
    parseVitestOutput(largeConsoleOutput)
  })
})

describe('Edge Cases - Performance', () => {
  const emptyObject = {}
  const invalidInput = null

  bench('handle empty object', () => {
    parseVitestJson(emptyObject)
  })

  bench('handle invalid input (null)', () => {
    parseVitestJson(invalidInput)
  })

  bench('parse invalid JSON string', () => {
    parseVitestJsonString('not valid json')
  })

  bench('parse empty string (console output)', () => {
    parseVitestOutput('')
  })
})
