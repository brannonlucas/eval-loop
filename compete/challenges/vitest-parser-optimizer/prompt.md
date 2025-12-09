# Challenge: Vitest Parser Optimizer

**YOU ARE COMPETING AGAINST OTHER AI MODELS.** This is a head-to-head competition where your solution will be benchmarked against Claude Sonnet 4, Claude Opus 4.5, and GPT-4o. The winner is determined by correctness first, then raw performance on parsing vitest output.

Optimize a TypeScript module that parses vitest JSON reporter output into structured test failure information.

## Requirements

The module must export these interfaces and functions:

```typescript
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

// Parse vitest JSON reporter output object
export function parseVitestJson(json: unknown): ParsedTestOutput

// Parse vitest JSON from a string (handles JSON.parse errors)
export function parseVitestJsonString(jsonString: string): ParsedTestOutput

// Parse raw vitest console output (fallback when JSON isn't available)
export function parseVitestOutput(stdout: string): ParsedTestOutput | null
```

## Behavior Specifications

### `parseVitestJson(json: unknown)`

1. Returns error result for null, undefined, non-objects, booleans, strings, numbers
2. Extracts `numTotalTests`, `numPassedTests`, `numFailedTests` (default to 0 if missing/wrong type)
3. Extracts `success` flag for `passed` field
4. Processes `testResults[]` array for failures:
   - Suite-level errors: when `status === 'failed'` and `message` exists
   - Assertion failures: from `assertionResults[]` where `status === 'failed'`
5. For test names: use `fullName`, fallback to `title`, fallback to `'unknown'`
6. Extract expected/received from failure messages using these patterns:
   - `Expected: X` / `Received: Y` on separate lines
   - `expected X to be Y` or `expected X to equal Y`

### `parseVitestJsonString(jsonString: string)`

1. JSON.parse the string, pass to parseVitestJson
2. On parse error, return failure with truncated error message (first 200 chars)

### `parseVitestOutput(stdout: string)`

1. Return null for null, undefined, empty string, non-strings
2. Extract counts from summary line: `Tests  N failed | M passed`
3. Extract failures from lines starting with `✕` or `×` markers
4. Collect error lines following each failed test
5. Return null if no structured data found

## Constraints

- No external dependencies (no lodash, no npm packages)
- Must be a single file with TypeScript strict mode
- Must export exact interfaces and function signatures above
- Must handle all edge cases (the tests are comprehensive)

## Scoring

Your solution will be scored on:
1. **Correctness** - Must pass all 50+ test cases
2. **Performance** - Ops/sec parsing JSON with 10, 100, and 1000 test results
3. **Performance** - Ops/sec parsing console output with various sizes

## Optimization Opportunities

The current implementation has room for improvement:
- Regex patterns are compiled on every call
- Multiple passes over the same data
- String operations that could be optimized
- Type checking that could be streamlined

## Tips

- Pre-compile regex patterns outside functions
- Consider early returns for common cases
- Minimize string allocations
- Think about the order of checks (most common first)
- Profile before optimizing - measure what's actually slow

## Previous Attempt Feedback

{{feedback}}
