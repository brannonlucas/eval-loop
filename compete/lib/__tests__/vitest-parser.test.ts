/**
 * Unit Tests: vitest-parser.ts
 *
 * Comprehensive tests for parsing vitest JSON and console output
 * into structured test failure information.
 */

import { describe, it, expect } from 'vitest'
import {
  parseVitestJson,
  parseVitestJsonString,
  parseVitestOutput,
  type ParsedTestOutput,
  type TestFailure,
} from '../vitest-parser'

describe('vitest-parser', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // parseVitestJson
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseVitestJson', () => {
    describe('invalid inputs', () => {
      it('returns error for null input', () => {
        const result = parseVitestJson(null)

        expect(result.passed).toBe(false)
        expect(result.numTests).toBe(0)
        expect(result.failures).toHaveLength(1)
        expect(result.failures[0].testName).toBe('parse')
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
        expect(result.failures[0].error).toBe('Invalid JSON input')
      })

      it('returns error for number input', () => {
        const result = parseVitestJson(42)

        expect(result.passed).toBe(false)
        expect(result.failures[0].error).toBe('Invalid JSON input')
      })

      it('handles array input as empty object (arrays are objects in JS)', () => {
        // Note: Arrays pass typeof check as 'object' in JS
        // This documents actual behavior - parser treats array as empty object
        const result = parseVitestJson([1, 2, 3])

        expect(result.passed).toBe(false) // success !== true
        expect(result.numTests).toBe(0)
        expect(result.failures).toHaveLength(0)
      })

      it('returns error for boolean input', () => {
        const resultTrue = parseVitestJson(true)
        const resultFalse = parseVitestJson(false)

        expect(resultTrue.passed).toBe(false)
        expect(resultTrue.failures[0].error).toBe('Invalid JSON input')
        expect(resultFalse.passed).toBe(false)
        expect(resultFalse.failures[0].error).toBe('Invalid JSON input')
      })
    })

    describe('empty and minimal objects', () => {
      it('handles empty object with zero counts', () => {
        const result = parseVitestJson({})

        expect(result.passed).toBe(false) // success !== true
        expect(result.numTests).toBe(0)
        expect(result.numPassed).toBe(0)
        expect(result.numFailed).toBe(0)
        expect(result.failures).toHaveLength(0)
      })

      it('handles object with only success flag', () => {
        const result = parseVitestJson({ success: true })

        expect(result.passed).toBe(true)
        expect(result.numTests).toBe(0)
        expect(result.failures).toHaveLength(0)
      })

      it('handles object with wrong types for counts', () => {
        const result = parseVitestJson({
          numTotalTests: 'five',
          numPassedTests: null,
          numFailedTests: undefined,
        })

        expect(result.numTests).toBe(0)
        expect(result.numPassed).toBe(0)
        expect(result.numFailed).toBe(0)
      })

      it('handles negative numbers for counts', () => {
        const result = parseVitestJson({
          numTotalTests: -5,
          numPassedTests: -2,
          numFailedTests: -3,
        })

        // Parser should accept the values (no validation)
        expect(result.numTests).toBe(-5)
        expect(result.numPassed).toBe(-2)
        expect(result.numFailed).toBe(-3)
      })

      it('handles float numbers for counts', () => {
        const result = parseVitestJson({
          numTotalTests: 5.7,
          numPassedTests: 3.2,
          numFailedTests: 2.5,
        })

        // Parser should accept the values (no truncation)
        expect(result.numTests).toBe(5.7)
        expect(result.numPassed).toBe(3.2)
        expect(result.numFailed).toBe(2.5)
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
        expect(result.failures).toHaveLength(0)
      })

      it('parses all tests passed with assertion results', () => {
        const result = parseVitestJson({
          success: true,
          numTotalTests: 2,
          numPassedTests: 2,
          numFailedTests: 0,
          testResults: [
            {
              name: '/path/to/test.ts',
              status: 'passed',
              assertionResults: [
                { status: 'passed', fullName: 'test one' },
                { status: 'passed', fullName: 'test two' },
              ],
            },
          ],
        })

        expect(result.passed).toBe(true)
        expect(result.failures).toHaveLength(0)
      })
    })

    describe('suite-level failures', () => {
      it('captures suite-level error (e.g., import failure)', () => {
        const result = parseVitestJson({
          success: false,
          numTotalTests: 0,
          numPassedTests: 0,
          numFailedTests: 1,
          testResults: [
            {
              name: '/path/to/broken.test.ts',
              status: 'failed',
              message: "Cannot find module './missing-module'",
              assertionResults: [],
            },
          ],
        })

        expect(result.passed).toBe(false)
        expect(result.failures).toHaveLength(1)
        expect(result.failures[0].testName).toBe('broken.test.ts')
        expect(result.failures[0].error).toBe("Cannot find module './missing-module'")
      })

      it('extracts filename from full path', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              name: '/Users/dev/project/src/__tests__/deep/nested/file.test.ts',
              status: 'failed',
              message: 'Syntax error',
            },
          ],
        })

        expect(result.failures[0].testName).toBe('file.test.ts')
      })

      it('handles suite error with missing name', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              status: 'failed',
              message: 'Some error',
            },
          ],
        })

        expect(result.failures[0].testName).toBe('unknown')
      })

      it('does NOT extract filename from Windows-style paths (known limitation)', () => {
        // KNOWN LIMITATION: extractFileName only splits on forward slashes
        // Windows paths with backslashes are returned as-is
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              name: 'C:\\Users\\dev\\project\\src\\__tests__\\file.test.ts',
              status: 'failed',
              message: 'Syntax error',
            },
          ],
        })

        // Documents actual behavior - full path returned, not filename
        expect(result.failures[0].testName).toBe('C:\\Users\\dev\\project\\src\\__tests__\\file.test.ts')
      })

      it('extracts filename from mixed path separators', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              name: 'C:\\Users\\dev/project/src/__tests__/file.test.ts',
              status: 'failed',
              message: 'Error',
            },
          ],
        })

        expect(result.failures[0].testName).toBe('file.test.ts')
      })

      it('handles filename with no path separators', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              name: 'simple-test.ts',
              status: 'failed',
              message: 'Error',
            },
          ],
        })

        expect(result.failures[0].testName).toBe('simple-test.ts')
      })
    })

    describe('assertion failures', () => {
      it('captures single assertion failure', () => {
        const result = parseVitestJson({
          success: false,
          numTotalTests: 1,
          numPassedTests: 0,
          numFailedTests: 1,
          testResults: [
            {
              name: '/path/to/test.ts',
              status: 'failed',
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'my test > should work',
                  failureMessages: ['Expected: 5\nReceived: 4'],
                },
              ],
            },
          ],
        })

        expect(result.failures).toHaveLength(1)
        expect(result.failures[0].testName).toBe('my test > should work')
        expect(result.failures[0].error).toBe('Expected: 5\nReceived: 4')
        expect(result.failures[0].expected).toBe('5')
        expect(result.failures[0].received).toBe('4')
      })

      it('captures multiple assertion failures', () => {
        const result = parseVitestJson({
          success: false,
          numTotalTests: 3,
          numPassedTests: 1,
          numFailedTests: 2,
          testResults: [
            {
              name: '/path/to/test.ts',
              assertionResults: [
                { status: 'passed', fullName: 'passing test' },
                {
                  status: 'failed',
                  fullName: 'failing test 1',
                  failureMessages: ['Error 1'],
                },
                {
                  status: 'failed',
                  fullName: 'failing test 2',
                  failureMessages: ['Error 2'],
                },
              ],
            },
          ],
        })

        expect(result.failures).toHaveLength(2)
        expect(result.failures[0].testName).toBe('failing test 1')
        expect(result.failures[1].testName).toBe('failing test 2')
      })

      it('uses title when fullName is missing', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  title: 'fallback title',
                  failureMessages: ['Error'],
                },
              ],
            },
          ],
        })

        expect(result.failures[0].testName).toBe('fallback title')
      })

      it('uses unknown when both fullName and title missing', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  failureMessages: ['Error'],
                },
              ],
            },
          ],
        })

        expect(result.failures[0].testName).toBe('unknown')
      })

      it('uses empty string fullName as-is (known limitation)', () => {
        // KNOWN LIMITATION: The parser uses `fullName || title || 'unknown'`
        // but doesn't check if the value is empty string specifically
        // In JavaScript, '' || 'unknown' => 'unknown', BUT the issue is
        // fullName exists (empty string), so it's used as the test name
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: '',
                  failureMessages: ['Error'],
                },
              ],
            },
          ],
        })

        // Documents actual behavior - empty string preserved, not replaced
        expect(result.failures[0].testName).toBe('')
      })

      it('uses empty string title as-is when fullName missing (known limitation)', () => {
        // Same limitation as above - empty strings are preserved
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  title: '',
                  failureMessages: ['Error'],
                },
              ],
            },
          ],
        })

        // Documents actual behavior - empty string preserved
        expect(result.failures[0].testName).toBe('')
      })

      it('prefers non-empty fullName over empty title', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'actual test name',
                  title: '',
                  failureMessages: ['Error'],
                },
              ],
            },
          ],
        })

        expect(result.failures[0].testName).toBe('actual test name')
      })

      it('joins multiple failure messages', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'test',
                  failureMessages: ['Error 1', 'Error 2', 'Error 3'],
                },
              ],
            },
          ],
        })

        expect(result.failures[0].error).toBe('Error 1\nError 2\nError 3')
      })

      it('uses default message when failureMessages empty', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'test',
                  failureMessages: [],
                },
              ],
            },
          ],
        })

        expect(result.failures[0].error).toBe('Test failed')
      })

      it('handles non-array failureMessages', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'test',
                  failureMessages: 'not an array',
                },
              ],
            },
          ],
        })

        expect(result.failures[0].error).toBe('Test failed')
      })
    })

    describe('expected/received extraction', () => {
      it('extracts "Expected: X / Received: Y" pattern', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'test',
                  failureMessages: ['AssertionError: \nExpected: "hello"\nReceived: "world"'],
                },
              ],
            },
          ],
        })

        expect(result.failures[0].expected).toBe('"hello"')
        expect(result.failures[0].received).toBe('"world"')
      })

      it('extracts case-insensitive expected/received', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'test',
                  failureMessages: ['EXPECTED: true\nRECEIVED: false'],
                },
              ],
            },
          ],
        })

        expect(result.failures[0].expected).toBe('true')
        expect(result.failures[0].received).toBe('false')
      })

      it('extracts "expected X to be Y" pattern', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'test',
                  failureMessages: ['expected 42 to be 100'],
                },
              ],
            },
          ],
        })

        expect(result.failures[0].expected).toBe('100')
        expect(result.failures[0].received).toBe('42')
      })

      it('extracts "expected X to equal Y" pattern', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'test',
                  failureMessages: ['expected [1,2,3] to equal [1,2,4]'],
                },
              ],
            },
          ],
        })

        expect(result.failures[0].expected).toBe('[1,2,4]')
        expect(result.failures[0].received).toBe('[1,2,3]')
      })

      it('returns undefined when no pattern matches', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'test',
                  failureMessages: ['TypeError: Cannot read property "foo" of undefined'],
                },
              ],
            },
          ],
        })

        expect(result.failures[0].expected).toBeUndefined()
        expect(result.failures[0].received).toBeUndefined()
      })

      it('handles only Expected without Received', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'test',
                  failureMessages: ['Expected: something'],
                },
              ],
            },
          ],
        })

        expect(result.failures[0].expected).toBe('something')
        expect(result.failures[0].received).toBeUndefined()
      })

      it('handles only Received without Expected', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'test',
                  failureMessages: ['Received: something unexpected'],
                },
              ],
            },
          ],
        })

        expect(result.failures[0].expected).toBeUndefined()
        expect(result.failures[0].received).toBe('something unexpected')
      })

      it('does NOT extract "to deeply equal" pattern (known limitation)', () => {
        // KNOWN LIMITATION: extractExpectedReceived only handles:
        // - "Expected: X / Received: Y" format
        // - "expected X to be Y" format
        // - "expected X to equal Y" format
        // It does NOT handle "to deeply equal" or "to strictly equal"
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'test',
                  failureMessages: ['expected { a: 1, b: 2 } to deeply equal { a: 1, b: 3 }'],
                },
              ],
            },
          ],
        })

        // Documents actual behavior - pattern not matched
        expect(result.failures[0].expected).toBeUndefined()
        expect(result.failures[0].received).toBeUndefined()
      })

      it('does NOT extract "to strictly equal" pattern (known limitation)', () => {
        // Same limitation as "to deeply equal"
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'test',
                  failureMessages: ['expected "hello" to strictly equal "world"'],
                },
              ],
            },
          ],
        })

        // Documents actual behavior - pattern not matched
        expect(result.failures[0].expected).toBeUndefined()
        expect(result.failures[0].received).toBeUndefined()
      })

      it('handles colon in expected/received values', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'test',
                  failureMessages: ['Expected: key: value\nReceived: other: thing'],
                },
              ],
            },
          ],
        })

        expect(result.failures[0].expected).toBe('key: value')
        expect(result.failures[0].received).toBe('other: thing')
      })

      it('handles multiline expected/received values', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'test',
                  failureMessages: ['Expected: {\n  "a": 1\n}\nReceived: {\n  "a": 2\n}'],
                },
              ],
            },
          ],
        })

        // The regex captures until newline, so we get the first line
        expect(result.failures[0].expected).toBe('{')
        expect(result.failures[0].received).toBe('{')
      })
    })

    describe('mixed suite and assertion failures', () => {
      it('captures both suite-level and assertion failures', () => {
        const result = parseVitestJson({
          success: false,
          numTotalTests: 2,
          numFailedTests: 2,
          testResults: [
            {
              name: '/path/to/broken.test.ts',
              status: 'failed',
              message: 'Import error',
              assertionResults: [],
            },
            {
              name: '/path/to/partial.test.ts',
              assertionResults: [
                {
                  status: 'failed',
                  fullName: 'assertion failure',
                  failureMessages: ['Test error'],
                },
              ],
            },
          ],
        })

        expect(result.failures).toHaveLength(2)
        expect(result.failures[0].testName).toBe('broken.test.ts')
        expect(result.failures[1].testName).toBe('assertion failure')
      })
    })

    describe('edge cases in testResults', () => {
      it('skips non-object items in testResults', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [null, undefined, 'string', 123, { status: 'failed', message: 'Real error' }],
        })

        expect(result.failures).toHaveLength(1)
        expect(result.failures[0].error).toBe('Real error')
      })

      it('skips non-object items in assertionResults', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: [
                null,
                'not an object',
                { status: 'failed', fullName: 'real test', failureMessages: ['Error'] },
              ],
            },
          ],
        })

        expect(result.failures).toHaveLength(1)
        expect(result.failures[0].testName).toBe('real test')
      })

      it('handles non-array testResults', () => {
        const result = parseVitestJson({
          success: false,
          testResults: 'not an array',
        })

        expect(result.failures).toHaveLength(0)
      })

      it('handles non-array assertionResults', () => {
        const result = parseVitestJson({
          success: false,
          testResults: [
            {
              assertionResults: 'not an array',
            },
          ],
        })

        expect(result.failures).toHaveLength(0)
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // parseVitestJsonString
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseVitestJsonString', () => {
    it('parses valid JSON string', () => {
      const json = JSON.stringify({
        success: true,
        numTotalTests: 3,
        numPassedTests: 3,
        numFailedTests: 0,
      })

      const result = parseVitestJsonString(json)

      expect(result.passed).toBe(true)
      expect(result.numTests).toBe(3)
    })

    it('returns parse error for invalid JSON', () => {
      const result = parseVitestJsonString('{ invalid json }')

      expect(result.passed).toBe(false)
      expect(result.failures).toHaveLength(1)
      expect(result.failures[0].testName).toBe('parse')
      expect(result.failures[0].error).toContain('Failed to parse JSON')
    })

    it('truncates long invalid JSON in error message', () => {
      const longInvalidJson = 'x'.repeat(500)
      const result = parseVitestJsonString(longInvalidJson)

      expect(result.failures[0].error.length).toBeLessThan(300)
    })

    it('handles empty string', () => {
      const result = parseVitestJsonString('')

      expect(result.passed).toBe(false)
      expect(result.failures[0].error).toContain('Failed to parse JSON')
    })

    it('handles whitespace-only string', () => {
      const result = parseVitestJsonString('   \n\t  ')

      expect(result.passed).toBe(false)
    })

    it('propagates to parseVitestJson for object handling', () => {
      const json = JSON.stringify({
        success: false,
        testResults: [
          {
            name: '/test.ts',
            status: 'failed',
            message: 'Error from string',
          },
        ],
      })

      const result = parseVitestJsonString(json)

      expect(result.failures[0].error).toBe('Error from string')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // parseVitestOutput (console output fallback parser)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseVitestOutput', () => {
    describe('invalid inputs', () => {
      it('returns null for null input', () => {
        const result = parseVitestOutput(null as unknown as string)
        expect(result).toBeNull()
      })

      it('returns null for undefined input', () => {
        const result = parseVitestOutput(undefined as unknown as string)
        expect(result).toBeNull()
      })

      it('returns null for empty string', () => {
        const result = parseVitestOutput('')
        expect(result).toBeNull()
      })

      it('returns null for non-string input', () => {
        const result = parseVitestOutput(123 as unknown as string)
        expect(result).toBeNull()
      })
    })

    describe('summary line parsing', () => {
      it('extracts counts from summary line', () => {
        const output = `
 FAIL  src/test.ts
 Tests  2 failed | 8 passed (10)
`
        const result = parseVitestOutput(output)

        expect(result).not.toBeNull()
        expect(result!.passed).toBe(false)
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

      it('returns null for reversed summary format (known limitation)', () => {
        // KNOWN LIMITATION: Regex only matches "X failed | Y passed" format
        // Some vitest versions might output "Tests  5 passed | 1 failed" (passed first)
        const output = 'Tests  5 passed | 1 failed'
        const result = parseVitestOutput(output)

        // Documents actual behavior - reversed format returns null
        expect(result).toBeNull()
      })

      it('handles summary with total in parentheses', () => {
        const output = 'Tests  2 failed | 8 passed (10)'
        const result = parseVitestOutput(output)

        expect(result!.numTests).toBe(10)
      })

      it('handles summary without total', () => {
        const output = 'Tests  2 failed | 8 passed'
        const result = parseVitestOutput(output)

        // When no total in parens, calculate from failed + passed
        expect(result!.numTests).toBe(10)
      })
    })

    describe('failed test extraction', () => {
      it('extracts test name with ✕ marker', () => {
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

      it('extracts test name with × marker', () => {
        const output = `
 × another test name (10 ms)
    Some error message
 Tests  1 failed | 0 passed
`
        const result = parseVitestOutput(output)

        expect(result!.failures[0].testName).toBe('another test name')
      })

      it('strips duration from test name', () => {
        const output = `
 ✕ test with duration (123 ms)
    Error
 Tests  1 failed | 0 passed
`
        const result = parseVitestOutput(output)

        expect(result!.failures[0].testName).toBe('test with duration')
        expect(result!.failures[0].testName).not.toContain('ms')
      })

      it('handles test name without duration', () => {
        const output = `
 ✕ test without timing
    Error here
 Tests  1 failed | 0 passed
`
        const result = parseVitestOutput(output)

        expect(result!.failures[0].testName).toBe('test without timing')
      })

      it('collects error lines after failed test', () => {
        const output = `
 ✕ my failing test
    Line 1 of error
    Line 2 of error
    Line 3 of error
 Tests  1 failed | 0 passed
`
        const result = parseVitestOutput(output)

        expect(result!.failures[0].error).toContain('Line 1 of error')
        expect(result!.failures[0].error).toContain('Line 2 of error')
        expect(result!.failures[0].error).toContain('Line 3 of error')
      })
    })

    describe('multiple failures', () => {
      it('extracts multiple failed tests', () => {
        const output = `
 ✕ first failure (5 ms)
    Error 1
 ✕ second failure (10 ms)
    Error 2
 ✓ passing test (1 ms)
 ✕ third failure
    Error 3
 Tests  3 failed | 1 passed
`
        const result = parseVitestOutput(output)

        expect(result!.failures).toHaveLength(3)
        expect(result!.failures[0].testName).toBe('first failure')
        expect(result!.failures[0].error).toContain('Error 1')
        expect(result!.failures[1].testName).toBe('second failure')
        expect(result!.failures[2].testName).toBe('third failure')
      })

      it('stops collecting error at next test', () => {
        const output = `
 ✕ test one
    Error for test one
 ✓ test two (passing)
 ✕ test three
    Error for test three
 Tests  2 failed | 1 passed
`
        const result = parseVitestOutput(output)

        expect(result!.failures[0].error).not.toContain('Error for test three')
        expect(result!.failures[1].error).toContain('Error for test three')
      })
    })

    describe('edge cases', () => {
      it('returns null when no structured data found', () => {
        const output = 'Just some random text without vitest output'
        const result = parseVitestOutput(output)

        expect(result).toBeNull()
      })

      it('includes stdout in result', () => {
        const output = `
Full stdout content here
 Tests  1 failed | 2 passed
`
        const result = parseVitestOutput(output)

        expect(result!.stdout).toBe(output)
      })

      it('handles failures without error content', () => {
        const output = `
 ✕ test with no details
 Tests  1 failed | 0 passed
`
        const result = parseVitestOutput(output)

        // Should still capture the test even without error details
        expect(result!.numFailed).toBe(1)
      })

      it('handles output with only summary (no detailed failures)', () => {
        const output = 'Tests  3 failed | 7 passed'
        const result = parseVitestOutput(output)

        expect(result!.passed).toBe(false)
        expect(result!.numFailed).toBe(3)
        expect(result!.numPassed).toBe(7)
        expect(result!.failures).toHaveLength(0) // No detailed failures extracted
      })

      it('handles output with only failures (no summary)', () => {
        const output = `
 ✕ orphan failure
    Some error
`
        const result = parseVitestOutput(output)

        expect(result).not.toBeNull()
        expect(result!.failures).toHaveLength(1)
        expect(result!.failures[0].testName).toBe('orphan failure')
      })

      it('trims whitespace from test names and errors', () => {
        const output = `
 ✕   spaced test name   (5 ms)
       indented error
 Tests  1 failed | 0 passed
`
        const result = parseVitestOutput(output)

        expect(result!.failures[0].testName).toBe('spaced test name')
        expect(result!.failures[0].error).not.toMatch(/^\s+/)
        expect(result!.failures[0].error).not.toMatch(/\s+$/)
      })

      it('handles real-world vitest output format', () => {
        const output = `
 FAIL  compete/.tmp/test-abc123/spec.test.ts > fastest-sort > handles negative numbers
AssertionError: expected [ -3, -1, 0, 2, 5 ] to deeply equal [ -3, -1, 0, 2, …(1) ]

- Expected
+ Received

  Array [
    -3,
    -1,
    0,
    2,
-   5,
+   4,
  ]

 ❯ compete/.tmp/test-abc123/spec.test.ts:25:18

 ✕ handles negative numbers (3 ms)

 Tests  1 failed | 4 passed (5)
 Duration  1.23s
`
        const result = parseVitestOutput(output)

        expect(result!.passed).toBe(false)
        expect(result!.numFailed).toBe(1)
        expect(result!.numPassed).toBe(4)
        expect(result!.numTests).toBe(5)
        expect(result!.failures.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Type safety and interface compliance
  // ═══════════════════════════════════════════════════════════════════════════

  describe('type compliance', () => {
    it('parseVitestJson returns ParsedTestOutput', () => {
      const result: ParsedTestOutput = parseVitestJson({ success: true })

      expect(result).toHaveProperty('passed')
      expect(result).toHaveProperty('numTests')
      expect(result).toHaveProperty('numPassed')
      expect(result).toHaveProperty('numFailed')
      expect(result).toHaveProperty('failures')
    })

    it('failures array contains TestFailure objects', () => {
      const result = parseVitestJson({
        success: false,
        testResults: [
          {
            assertionResults: [
              { status: 'failed', fullName: 'test', failureMessages: ['err'] },
            ],
          },
        ],
      })

      const failure: TestFailure = result.failures[0]
      expect(failure).toHaveProperty('testName')
      expect(failure).toHaveProperty('error')
      // expected and received are optional
    })

    it('parseVitestOutput returns ParsedTestOutput | null', () => {
      const nullResult: ParsedTestOutput | null = parseVitestOutput('')
      expect(nullResult).toBeNull()

      const validResult: ParsedTestOutput | null = parseVitestOutput('Tests  1 failed | 0 passed')
      expect(validResult).not.toBeNull()
      expect(validResult!.failures).toBeDefined()
    })
  })
})
