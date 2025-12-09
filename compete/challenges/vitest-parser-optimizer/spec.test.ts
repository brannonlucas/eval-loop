import { describe, it, expect } from 'vitest'
import { parseVitestJson, parseVitestJsonString, parseVitestOutput } from './solution'

describe('parseVitestJson - Correctness', () => {
  describe('invalid inputs', () => {
    it('returns error for null input', () => {
      const result = parseVitestJson(null)
      expect(result.passed).toBe(false)
      expect(result.failures[0].error).toBe('Invalid JSON input')
    })

    it('returns error for undefined input', () => {
      const result = parseVitestJson(undefined)
      expect(result.passed).toBe(false)
      expect(result.failures[0].error).toBe('Invalid JSON input')
    })

    it('returns error for string input', () => {
      const result = parseVitestJson('not an object')
      expect(result.passed).toBe(false)
    })

    it('returns error for number input', () => {
      const result = parseVitestJson(42)
      expect(result.passed).toBe(false)
    })

    it('returns error for boolean input', () => {
      const resultTrue = parseVitestJson(true)
      const resultFalse = parseVitestJson(false)
      expect(resultTrue.passed).toBe(false)
      expect(resultFalse.passed).toBe(false)
    })
  })

  describe('empty and minimal objects', () => {
    it('handles empty object with zero counts', () => {
      const result = parseVitestJson({})
      expect(result.numTests).toBe(0)
      expect(result.numPassed).toBe(0)
      expect(result.numFailed).toBe(0)
      expect(result.failures).toEqual([])
    })

    it('handles object with only success flag', () => {
      const result = parseVitestJson({ success: true })
      expect(result.passed).toBe(true)
      expect(result.failures).toEqual([])
    })

    it('handles object with wrong types for counts', () => {
      const result = parseVitestJson({
        numTotalTests: 'not a number',
        numPassedTests: null,
        numFailedTests: undefined,
      })
      expect(result.numTests).toBe(0)
      expect(result.numPassed).toBe(0)
      expect(result.numFailed).toBe(0)
    })
  })

  describe('successful test runs', () => {
    it('parses passing test suite', () => {
      const result = parseVitestJson({
        success: true,
        numTotalTests: 5,
        numPassedTests: 5,
        numFailedTests: 0,
        testResults: [],
      })

      expect(result.passed).toBe(true)
      expect(result.numTests).toBe(5)
      expect(result.numPassed).toBe(5)
      expect(result.numFailed).toBe(0)
      expect(result.failures).toEqual([])
    })

    it('parses all tests passed with assertion results', () => {
      const result = parseVitestJson({
        success: true,
        numTotalTests: 2,
        numPassedTests: 2,
        numFailedTests: 0,
        testResults: [{
          name: 'test.ts',
          status: 'passed',
          assertionResults: [
            { status: 'passed', fullName: 'test one' },
            { status: 'passed', fullName: 'test two' },
          ],
        }],
      })

      expect(result.passed).toBe(true)
      expect(result.failures).toEqual([])
    })
  })

  describe('suite-level failures', () => {
    it('captures suite-level error (e.g., import failure)', () => {
      const result = parseVitestJson({
        success: false,
        numTotalTests: 0,
        numPassedTests: 0,
        numFailedTests: 1,
        testResults: [{
          name: '/path/to/broken.test.ts',
          status: 'failed',
          message: "Cannot find module './missing'",
        }],
      })

      expect(result.passed).toBe(false)
      expect(result.failures).toHaveLength(1)
      expect(result.failures[0].error).toContain("Cannot find module")
    })

    it('extracts filename from full path', () => {
      const result = parseVitestJson({
        success: false,
        testResults: [{
          name: '/Users/dev/project/src/__tests__/file.test.ts',
          status: 'failed',
          message: 'Syntax error',
        }],
      })

      expect(result.failures[0].testName).toBe('file.test.ts')
    })

    it('handles suite error with missing name', () => {
      const result = parseVitestJson({
        success: false,
        testResults: [{
          status: 'failed',
          message: 'Some error',
        }],
      })

      expect(result.failures[0].testName).toBe('unknown')
    })
  })

  describe('assertion failures', () => {
    it('captures single assertion failure', () => {
      const result = parseVitestJson({
        success: false,
        numTotalTests: 1,
        numPassedTests: 0,
        numFailedTests: 1,
        testResults: [{
          name: 'test.ts',
          assertionResults: [{
            status: 'failed',
            fullName: 'should add numbers',
            failureMessages: ['Expected: 4\nReceived: 5'],
          }],
        }],
      })

      expect(result.failures).toHaveLength(1)
      expect(result.failures[0].testName).toBe('should add numbers')
      expect(result.failures[0].expected).toBe('4')
      expect(result.failures[0].received).toBe('5')
    })

    it('captures multiple assertion failures', () => {
      const result = parseVitestJson({
        success: false,
        testResults: [{
          name: 'test.ts',
          assertionResults: [
            { status: 'failed', fullName: 'test one', failureMessages: ['error 1'] },
            { status: 'passed', fullName: 'test two' },
            { status: 'failed', fullName: 'test three', failureMessages: ['error 3'] },
          ],
        }],
      })

      expect(result.failures).toHaveLength(2)
      expect(result.failures[0].testName).toBe('test one')
      expect(result.failures[1].testName).toBe('test three')
    })

    it('uses title when fullName is missing', () => {
      const result = parseVitestJson({
        success: false,
        testResults: [{
          name: 'test.ts',
          assertionResults: [{
            status: 'failed',
            title: 'fallback title',
            failureMessages: ['error'],
          }],
        }],
      })

      expect(result.failures[0].testName).toBe('fallback title')
    })

    it('uses unknown when both fullName and title missing', () => {
      const result = parseVitestJson({
        success: false,
        testResults: [{
          name: 'test.ts',
          assertionResults: [{
            status: 'failed',
            failureMessages: ['error'],
          }],
        }],
      })

      expect(result.failures[0].testName).toBe('unknown')
    })

    it('joins multiple failure messages', () => {
      const result = parseVitestJson({
        success: false,
        testResults: [{
          name: 'test.ts',
          assertionResults: [{
            status: 'failed',
            fullName: 'test',
            failureMessages: ['error line 1', 'error line 2'],
          }],
        }],
      })

      expect(result.failures[0].error).toBe('error line 1\nerror line 2')
    })

    it('uses default message when failureMessages empty', () => {
      const result = parseVitestJson({
        success: false,
        testResults: [{
          name: 'test.ts',
          assertionResults: [{
            status: 'failed',
            fullName: 'test',
            failureMessages: [],
          }],
        }],
      })

      expect(result.failures[0].error).toBe('Test failed')
    })
  })

  describe('expected/received extraction', () => {
    it('extracts "Expected: X / Received: Y" pattern', () => {
      const result = parseVitestJson({
        success: false,
        testResults: [{
          name: 'test.ts',
          assertionResults: [{
            status: 'failed',
            fullName: 'test',
            failureMessages: ['Expected: 42\nReceived: 43'],
          }],
        }],
      })

      expect(result.failures[0].expected).toBe('42')
      expect(result.failures[0].received).toBe('43')
    })

    it('extracts case-insensitive expected/received', () => {
      const result = parseVitestJson({
        success: false,
        testResults: [{
          name: 'test.ts',
          assertionResults: [{
            status: 'failed',
            fullName: 'test',
            failureMessages: ['expected: foo\nreceived: bar'],
          }],
        }],
      })

      expect(result.failures[0].expected).toBe('foo')
      expect(result.failures[0].received).toBe('bar')
    })

    it('extracts "expected X to be Y" pattern', () => {
      const result = parseVitestJson({
        success: false,
        testResults: [{
          name: 'test.ts',
          assertionResults: [{
            status: 'failed',
            fullName: 'test',
            failureMessages: ['expected 5 to be 10'],
          }],
        }],
      })

      expect(result.failures[0].expected).toBe('10')
      expect(result.failures[0].received).toBe('5')
    })

    it('extracts "expected X to equal Y" pattern', () => {
      const result = parseVitestJson({
        success: false,
        testResults: [{
          name: 'test.ts',
          assertionResults: [{
            status: 'failed',
            fullName: 'test',
            failureMessages: ['expected "hello" to equal "world"'],
          }],
        }],
      })

      expect(result.failures[0].expected).toBe('"world"')
      expect(result.failures[0].received).toBe('"hello"')
    })

    it('returns undefined when no pattern matches', () => {
      const result = parseVitestJson({
        success: false,
        testResults: [{
          name: 'test.ts',
          assertionResults: [{
            status: 'failed',
            fullName: 'test',
            failureMessages: ['Something went wrong'],
          }],
        }],
      })

      expect(result.failures[0].expected).toBeUndefined()
      expect(result.failures[0].received).toBeUndefined()
    })
  })

  describe('edge cases in testResults', () => {
    it('skips non-object items in testResults', () => {
      const result = parseVitestJson({
        success: true,
        testResults: [null, 'string', 123, { name: 'valid.ts', status: 'passed' }],
      })

      expect(result.passed).toBe(true)
      expect(result.failures).toEqual([])
    })

    it('skips non-object items in assertionResults', () => {
      const result = parseVitestJson({
        success: true,
        testResults: [{
          name: 'test.ts',
          assertionResults: [null, 'string', 123, { status: 'passed', fullName: 'valid' }],
        }],
      })

      expect(result.passed).toBe(true)
      expect(result.failures).toEqual([])
    })

    it('handles non-array testResults', () => {
      const result = parseVitestJson({
        success: true,
        testResults: 'not an array',
      })

      expect(result.failures).toEqual([])
    })
  })
})

describe('parseVitestJsonString - Correctness', () => {
  it('parses valid JSON string', () => {
    const result = parseVitestJsonString('{"success": true, "numTotalTests": 5}')
    expect(result.passed).toBe(true)
    expect(result.numTests).toBe(5)
  })

  it('returns parse error for invalid JSON', () => {
    const result = parseVitestJsonString('not valid json')
    expect(result.passed).toBe(false)
    expect(result.failures[0].error).toContain('Failed to parse JSON')
  })

  it('truncates long invalid JSON in error message', () => {
    const longString = 'x'.repeat(500)
    const result = parseVitestJsonString(longString)
    expect(result.failures[0].error.length).toBeLessThan(300)
  })

  it('handles empty string', () => {
    const result = parseVitestJsonString('')
    expect(result.passed).toBe(false)
    expect(result.failures[0].error).toContain('Failed to parse JSON')
  })
})

describe('parseVitestOutput - Correctness', () => {
  describe('invalid inputs', () => {
    it('returns null for null input', () => {
      expect(parseVitestOutput(null as unknown as string)).toBeNull()
    })

    it('returns null for undefined input', () => {
      expect(parseVitestOutput(undefined as unknown as string)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(parseVitestOutput('')).toBeNull()
    })

    it('returns null for non-string input', () => {
      expect(parseVitestOutput(123 as unknown as string)).toBeNull()
    })
  })

  describe('summary line parsing', () => {
    it('extracts counts from summary line', () => {
      const output = 'Tests  2 failed | 8 passed'
      const result = parseVitestOutput(output)

      expect(result).not.toBeNull()
      expect(result!.numFailed).toBe(2)
      expect(result!.numPassed).toBe(8)
      expect(result!.numTests).toBe(10)
    })

    it('handles summary with extra whitespace', () => {
      const output = 'Tests   5   failed   |   10   passed'
      const result = parseVitestOutput(output)

      expect(result!.numFailed).toBe(5)
      expect(result!.numPassed).toBe(10)
    })

    it('marks as passed when no failures', () => {
      const output = 'Tests  0 failed | 5 passed'
      const result = parseVitestOutput(output)

      expect(result!.passed).toBe(true)
    })
  })

  describe('failed test extraction', () => {
    it('extracts test name with check mark marker', () => {
      const output = `
 ✕ should handle empty array (5 ms)
    Expected: []
    Received: undefined
 Tests  1 failed | 0 passed
`
      const result = parseVitestOutput(output)

      expect(result!.failures).toHaveLength(1)
      expect(result!.failures[0].testName).toBe('should handle empty array')
    })

    it('extracts test name with times marker', () => {
      const output = `
 × test fails (10 ms)
    Some error
 Tests  1 failed | 0 passed
`
      const result = parseVitestOutput(output)

      expect(result!.failures[0].testName).toBe('test fails')
    })

    it('strips duration from test name', () => {
      const output = `
 ✕ my test name (123 ms)
    error
 Tests  1 failed | 0 passed
`
      const result = parseVitestOutput(output)

      expect(result!.failures[0].testName).toBe('my test name')
    })

    it('collects error lines after failed test', () => {
      const output = `
 ✕ test name
    Error line 1
    Error line 2
 Tests  1 failed | 0 passed
`
      const result = parseVitestOutput(output)

      expect(result!.failures[0].error).toContain('Error line 1')
      expect(result!.failures[0].error).toContain('Error line 2')
    })
  })

  describe('multiple failures', () => {
    it('extracts multiple failed tests', () => {
      const output = `
 ✕ first test
    error 1
 ✕ second test
    error 2
 Tests  2 failed | 0 passed
`
      const result = parseVitestOutput(output)

      expect(result!.failures).toHaveLength(2)
      expect(result!.failures[0].testName).toBe('first test')
      expect(result!.failures[1].testName).toBe('second test')
    })
  })

  describe('edge cases', () => {
    it('returns null when no structured data found', () => {
      const result = parseVitestOutput('random text without any test info')
      expect(result).toBeNull()
    })

    it('includes stdout in result', () => {
      const output = 'Tests  1 failed | 1 passed'
      const result = parseVitestOutput(output)

      expect(result!.stdout).toBe(output)
    })
  })
})
