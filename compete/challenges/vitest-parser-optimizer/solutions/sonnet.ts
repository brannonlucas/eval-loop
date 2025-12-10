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

// Pre-compiled regex patterns for performance
const EXPECTED_RECEIVED_REGEX = /(?:^|\n)\s*(?:Expected|expected):\s*(.+?)(?:\n\s*(?:Received|received):\s*(.+?))?/i;
const EXPECTED_TO_BE_REGEX = /expected\s+(.+?)\s+to\s+(?:be|equal)\s+(.+?)(?:\s|$)/i;
const SUMMARY_REGEX = /Tests\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed/;
const FAILED_TEST_REGEX = /^[✕×]\s*(.+?)(?:\s*\(\d+\s*ms\))?$/;
const DURATION_STRIP_REGEX = /\s*\(\d+\s*ms\)$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getNumber(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  return typeof value === 'number' ? value : 0;
}

function extractExpectedReceived(error: string): { expected?: string; received?: string } {
  // Try Expected:/Received: pattern first (most common)
  let match = EXPECTED_RECEIVED_REGEX.exec(error);
  if (match) {
    return {
      expected: match[1]?.trim(),
      received: match[2]?.trim()
    };
  }

  // Try "expected X to be/equal Y" pattern
  match = EXPECTED_TO_BE_REGEX.exec(error);
  if (match) {
    return {
      expected: match[2]?.trim(),
      received: match[1]?.trim()
    };
  }

  return {};
}

export function parseVitestJson(json: unknown): ParsedTestOutput {
  if (!isObject(json)) {
    return {
      passed: false,
      numTests: 0,
      numPassed: 0,
      numFailed: 0,
      failures: [{ testName: 'Parser Error', error: 'Invalid JSON structure' }]
    };
  }

  const numTests = getNumber(json, 'numTotalTests');
  const numPassed = getNumber(json, 'numPassedTests');
  const numFailed = getNumber(json, 'numFailedTests');
  const passed = Boolean(json.success);
  const failures: TestFailure[] = [];

  const testResults = json.testResults;
  if (Array.isArray(testResults)) {
    for (const testResult of testResults) {
      if (!isObject(testResult)) continue;

      // Suite-level failure
      if (testResult.status === 'failed' && testResult.message) {
        const name = testResult.name;
        let testName = 'unknown';
        if (typeof name === 'string') {
          const lastSlash = name.lastIndexOf('/');
          testName = lastSlash >= 0 ? name.slice(lastSlash + 1) : name;
        }

        const errorMessage = String(testResult.message);
        failures.push({
          testName,
          error: errorMessage,
          ...extractExpectedReceived(errorMessage)
        });
      }

      // Assertion failures
      const assertionResults = testResult.assertionResults;
      if (Array.isArray(assertionResults)) {
        for (const assertion of assertionResults) {
          if (!isObject(assertion) || assertion.status !== 'failed') continue;

          const testName = typeof assertion.fullName === 'string' ? assertion.fullName :
                          typeof assertion.title === 'string' ? assertion.title : 'unknown';

          let errorMessage = 'Test failed';
          const failureMessages = assertion.failureMessages;
          if (Array.isArray(failureMessages) && failureMessages.length > 0) {
            errorMessage = failureMessages.map(String).join('\n');
          }

          failures.push({
            testName,
            error: errorMessage,
            ...extractExpectedReceived(errorMessage)
          });
        }
      }
    }
  }

  return {
    passed,
    numTests,
    numPassed,
    numFailed,
    failures
  };
}

export function parseVitestJsonString(jsonString: string): ParsedTestOutput {
  try {
    return parseVitestJson(JSON.parse(jsonString));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const truncatedInput = jsonString.length > 200 ? jsonString.slice(0, 200) : jsonString;
    return {
      passed: false,
      numTests: 0,
      numPassed: 0,
      numFailed: 0,
      failures: [{
        testName: 'JSON Parse Error',
        error: `${errorMessage}. Input: ${truncatedInput}`
      }]
    };
  }
}

export function parseVitestOutput(stdout: string): ParsedTestOutput | null {
  if (!stdout || typeof stdout !== 'string') {
    return null;
  }

  const lines = stdout.split('\n');
  let numFailed = 0;
  let numPassed = 0;

  // Find summary line
  for (const line of lines) {
    const summaryMatch = SUMMARY_REGEX.exec(line);
    if (summaryMatch) {
      numFailed = parseInt(summaryMatch[1], 10) || 0;
      numPassed = parseInt(summaryMatch[2], 10) || 0;
      break;
    }
  }

  const failures: TestFailure[] = [];
  let currentTest: string | null = null;
  let errorLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for failed test marker
    if (line.startsWith('✕') || line.startsWith('×')) {
      // Save previous test if exists
      if (currentTest) {
        failures.push({
          testName: currentTest,
          error: errorLines.join('\n') || 'Test failed'
        });
      }

      // Extract new test name and strip duration
      const match = FAILED_TEST_REGEX.exec(line);
      if (match) {
        currentTest = match[1].replace(DURATION_STRIP_REGEX, '');
      } else {
        // Fallback: strip marker and duration manually
        currentTest = line.slice(1).trim().replace(DURATION_STRIP_REGEX, '');
      }
      errorLines = [];
    } else if (currentTest && line.trim() && !line.match(/^[✓✕×]/)) {
      // Collect error lines
      errorLines.push(line);
    }
  }

  // Save last test
  if (currentTest) {
    failures.push({
      testName: currentTest,
      error: errorLines.join('\n') || 'Test failed'
    });
  }

  // Return null if no structured data found
  if (numFailed === 0 && numPassed === 0 && failures.length === 0) {
    return null;
  }

  const numTests = numFailed + numPassed;

  return {
    passed: numFailed === 0,
    numTests,
    numPassed,
    numFailed,
    failures,
    stdout
  };
}