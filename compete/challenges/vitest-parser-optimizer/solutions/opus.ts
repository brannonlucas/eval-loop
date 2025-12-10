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

const ERROR_RESULT: ParsedTestOutput = {
  passed: false,
  numTests: 0,
  numPassed: 0,
  numFailed: 1,
  failures: [{ testName: 'unknown', error: 'Invalid JSON input' }]
}

function extractExpectedReceived(msg: string): { expected?: string; received?: string } {
  let expected: string | undefined
  let received: string | undefined
  
  // Pattern 1: "Expected: X" / "Received: Y" on separate lines (case-insensitive)
  let idx = msg.indexOf('Expected:')
  if (idx === -1) idx = msg.indexOf('expected:')
  if (idx !== -1) {
    const start = idx + 9
    let end = msg.indexOf('\n', start)
    if (end === -1) end = msg.length
    expected = msg.substring(start, end).trim()
  }
  
  idx = msg.indexOf('Received:')
  if (idx === -1) idx = msg.indexOf('received:')
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
    let toBeIdx = msg.indexOf(' to be ', afterExpected)
    let toEqualIdx = msg.indexOf(' to equal ', afterExpected)
    
    if (toBeIdx !== -1 && (toEqualIdx === -1 || toBeIdx < toEqualIdx)) {
      expected = msg.substring(toBeIdx + 7).trim()
      received = msg.substring(afterExpected, toBeIdx).trim()
      return { expected, received }
    }
    
    if (toEqualIdx !== -1) {
      expected = msg.substring(toEqualIdx + 10).trim()
      received = msg.substring(afterExpected, toEqualIdx).trim()
      return { expected, received }
    }
  }
  
  return {}
}

function extractFilename(path: string): string {
  const lastSlash = path.lastIndexOf('/')
  return lastSlash !== -1 ? path.substring(lastSlash + 1) : path
}

export function parseVitestJson(json: unknown): ParsedTestOutput {
  if (json === null || json === undefined || typeof json !== 'object' || Array.isArray(json)) {
    return ERROR_RESULT
  }
  
  const obj = json as Record<string, unknown>
  
  const numTests = typeof obj.numTotalTests === 'number' ? obj.numTotalTests : 0
  const numPassed = typeof obj.numPassedTests === 'number' ? obj.numPassedTests : 0
  const numFailed = typeof obj.numFailedTests === 'number' ? obj.numFailedTests : 0
  const passed = obj.success === true
  
  const failures: TestFailure[] = []
  const testResults = obj.testResults
  
  if (Array.isArray(testResults)) {
    for (let i = 0, len = testResults.length; i < len; i++) {
      const suite = testResults[i]
      if (suite === null || typeof suite !== 'object') continue
      
      const s = suite as Record<string, unknown>
      
      // Suite-level errors
      if (s.status === 'failed' && typeof s.message === 'string' && s.message) {
        const name = typeof s.name === 'string' ? extractFilename(s.name) : 'unknown'
        const failure: TestFailure = { testName: name, error: s.message }
        const extracted = extractExpectedReceived(s.message)
        if (extracted.expected !== undefined) failure.expected = extracted.expected
        if (extracted.received !== undefined) failure.received = extracted.received
        failures.push(failure)
      }
      
      // Assertion failures
      const assertionResults = s.assertionResults
      if (Array.isArray(assertionResults)) {
        for (let j = 0, alen = assertionResults.length; j < alen; j++) {
          const assertion = assertionResults[j]
          if (assertion === null || typeof assertion !== 'object') continue
          
          const a = assertion as Record<string, unknown>
          if (a.status !== 'failed') continue
          
          const testName = typeof a.fullName === 'string' ? a.fullName
            : typeof a.title === 'string' ? a.title : 'unknown'
          
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
          
          const failure: TestFailure = { testName, error }
          const extracted = extractExpectedReceived(error)
          if (extracted.expected !== undefined) failure.expected = extracted.expected
          if (extracted.received !== undefined) failure.received = extracted.received
          failures.push(failure)
        }
      }
    }
  }
  
  return { passed, numTests, numPassed, numFailed, failures }
}

export function parseVitestJsonString(jsonString: string): ParsedTestOutput {
  try {
    return parseVitestJson(JSON.parse(jsonString))
  } catch (e) {
    const truncated = jsonString.length > 200 ? jsonString.substring(0, 200) + '...' : jsonString
    return {
      passed: false,
      numTests: 0,
      numPassed: 0,
      numFailed: 1,
      failures: [{ testName: 'unknown', error: 'Failed to parse JSON: ' + truncated }]
    }
  }
}

export function parseVitestOutput(stdout: string): ParsedTestOutput | null {
  if (typeof stdout !== 'string' || stdout === '') return null
  
  let numFailed = 0, numPassed = 0
  const failures: TestFailure[] = []
  let hasData = false
  
  let pos = 0
  const len = stdout.length
  
  while (pos < len) {
    let lineEnd = stdout.indexOf('\n', pos)
    if (lineEnd === -1) lineEnd = len
    const line = stdout.substring(pos, lineEnd)
    pos = lineEnd + 1
    
    // Check for summary line
    const testsIdx = line.indexOf('Tests')
    if (testsIdx !== -1) {
      const failedMatch = line.match(/(\d+)\s+failed/)
      const passedMatch = line.match(/(\d+)\s+passed/)
      if (failedMatch || passedMatch) {
        hasData = true
        if (failedMatch) numFailed = parseInt(failedMatch[1], 10)
        if (passedMatch) numPassed = parseInt(passedMatch[1], 10)
        continue
      }
    }
    
    // Check for failure markers
    const trimmed = line.trimStart()
    if (trimmed.length > 0 && (trimmed.charCodeAt(0) === 0x2715 || trimmed.charCodeAt(0) === 0xD7)) {
      hasData = true
      let testName = trimmed.substring(1).trim()
      // Strip duration like "(123 ms)"
      const durationMatch = testName.match(/\s+\(\d+\s*ms\)$/)
      if (durationMatch) {
        testName = testName.substring(0, testName.length - durationMatch[0].length)
      }
      
      // Collect error lines
      const errorLines: string[] = []
      while (pos < len) {
        let nextEnd = stdout.indexOf('\n', pos)
        if (nextEnd === -1) nextEnd = len
        const nextLine = stdout.substring(pos, nextEnd)
        const nextTrimmed = nextLine.trimStart()
        if (nextTrimmed === '' || nextTrimmed.charCodeAt(0) === 0x2715 || nextTrimmed.charCodeAt(0) === 0xD7 || nextTrimmed.startsWith('Tests')) break
        errorLines.push(nextLine.trim())
        pos = nextEnd + 1
      }
      
      const error = errorLines.join('\n') || 'Test failed'
      const failure: TestFailure = { testName, error }
      const extracted = extractExpectedReceived(error)
      if (extracted.expected !== undefined) failure.expected = extracted.expected
      if (extracted.received !== undefined) failure.received = extracted.received
      failures.push(failure)
    }
  }
  
  if (!hasData) return null
  
  return {
    passed: numFailed === 0,
    numTests: numFailed + numPassed,
    numPassed,
    numFailed,
    failures,
    stdout
  }
}