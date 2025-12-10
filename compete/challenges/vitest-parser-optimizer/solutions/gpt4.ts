export interface TestFailure {
    testName: string;
    error: string;
    expected?: string;
    received?: string;
}

export interface ParsedTestOutput {
    passed: boolean;
    numTests: number;
    numPassed: number;
    numFailed: number;
    failures: TestFailure[];
    stdout?: string;
}

const expectedReceivedRegex = /Expected: ([^\n]*)[^\r\n]*\nReceived: ([^\n]*)[^\r\n]*/;
const expectedToBeRegex = /expected (.*) to (be|equal) (.*)/i;

export function parseVitestJson(json: unknown): ParsedTestOutput {
    if (typeof json !== 'object' || json === null) {
        return {
            passed: false,
            numTests: 0,
            numPassed: 0,
            numFailed: 0,
            failures: [{ testName: 'unknown', error: 'Invalid input, expected a JSON object' }]
        };
    }
    
    const data = json as any;
    const numTests = typeof data.numTotalTests === 'number' ? data.numTotalTests : 0;
    const numPassed = typeof data.numPassedTests === 'number' ? data.numPassedTests : 0;
    const numFailed = typeof data.numFailedTests === 'number' ? data.numFailedTests : 0;
    const passed = Boolean(data.success);
    const failures: TestFailure[] = [];

    if (Array.isArray(data.testResults)) {
        for (const testResult of data.testResults) {
            if (typeof testResult !== 'object' || testResult === null) continue;
            if (testResult.status === 'failed' && testResult.message) {
                failures.push({
                    testName: extractTestName(testResult),
                    error: testResult.message
                });
            } else if (Array.isArray(testResult.assertionResults)) {
                for (const assertion of testResult.assertionResults) {
                    if (typeof assertion !== 'object' || assertion === null) continue;
                    if (assertion.status === 'failed') {
                        const errorMessage = assertion.failureMessages.join('\n') || 'Test failed';
                        const { expected, received } = extractExpectedReceived(errorMessage);

                        failures.push({
                            testName: extractTestName(assertion),
                            error: errorMessage,
                            expected,
                            received
                        });
                    }
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

function extractTestName(result: any): string {
    return result.fullName || result.title || 'unknown';
}

function extractExpectedReceived(message: string): { expected?: string, received?: string } {
    const expectedReceivedMatch = expectedReceivedRegex.exec(message);
    if (expectedReceivedMatch) {
        return { expected: expectedReceivedMatch[1], received: expectedReceivedMatch[2] };
    }

    const expectedToBeMatch = expectedToBeRegex.exec(message);
    if (expectedToBeMatch) {
        return { expected: expectedToBeMatch[1], received: expectedToBeMatch[3] };
    }
    return {};
}

export function parseVitestJsonString(jsonString: string): ParsedTestOutput {
    try {
        const parsedJson = JSON.parse(jsonString);
        return parseVitestJson(parsedJson);
    } catch (error) {
        return {
            passed: false,
            numTests: 0,
            numPassed: 0,
            numFailed: 0,
            failures: [{ 
                testName: 'unknown', 
                error: `Failed to parse JSON: ${error.message}`.slice(0, 200)
            }]
        };
    }
}

const summaryLineRegex = /Tests\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed/;
const failedTestLineRegex = /^[\s✕×]\s+(.*)/;

export function parseVitestOutput(stdout: string): ParsedTestOutput | null {
    if (!stdout || typeof stdout !== 'string') return null;

    const summaryMatch = summaryLineRegex.exec(stdout);
    if (!summaryMatch) return null;

    const numFailed = parseInt(summaryMatch[1], 10);
    const numPassed = parseInt(summaryMatch[2], 10);
    const numTests = numFailветed + numPassed;
    const passed = numFailed === 0;

    const failures: TestFailure[] = [];
    const lines = stdout.split('\n');
    let collectingError = false;
    let currentTestName = '';
    let errorLines: string[] = [];

    for (let line of lines) {
        const failedTestMatch = failedTestLineRegex.exec(line);
        if (failedTestMatch) {
            // If we're collecting an error from a previous test, finalize it
            if (collectingError) {
                failures.push({ testName: currentTestName.trim(), error: errorLines.join('\n') });
                errorLines = [];
            }
            
            currentTestName = failedTestMatch[1].replace(/\s+\(\d+ms\)$/, '');
            collectingError = true;
        } else if (collectingError) {
            if (line.trim() === '') {
                if (errorLines.length > 0) {
                    failures.push({ testName: currentTestName.trim(), error: errorLines.join('\n') });
                    collectingError = false;
                    errorLines = [];
                }
            } else {
                errorLines.push(line);
            }
        }
    }

    if (collectingError && errorLines.length > 0) {
        failures.push({ testName: currentTestName.trim(), error: errorLines.join('\n') });
    }

    return { passed, numTests, numPassed, numFailed, failures, stdout };
}