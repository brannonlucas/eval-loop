# Feature Request: Debug Endpoint for Job Inspection

## Problem

When a competition fails, the current error output in `/api/jobs/{id}` is truncated JSON that's hard to parse:

```json
{
  "error": "{\"numTotalTestSuites\":1,\"numPassedTestSuites\":0,\"numFailedTestSuites\":1,\"numPendingTestSuites\":0,\"numTotalTests\":0,..."
}
```

To debug failures, users must:
1. Know that debug files exist in `compete/debug/`
2. Manually find the correct timestamped directory
3. Read multiple files (solution.ts, result.json)
4. Parse truncated vitest output manually

## Proposed Solution

Add a `/api/jobs/{id}/debug` endpoint that returns full debugging information:

```typescript
// GET /api/jobs/{id}/debug
interface JobDebugResponse {
  jobId: string;
  challenge: string;
  timestamp: string;
  models: {
    [modelId: string]: {
      attempts: Array<{
        attemptNumber: number;
        solution: string;           // Full generated code
        testOutput: {
          passed: boolean;
          numTests: number;
          numPassed: number;
          numFailed: number;
          failures: Array<{
            testName: string;
            error: string;
            expected?: string;
            received?: string;
          }>;
          stdout?: string;          // Full vitest stdout
        };
        prompt: string;             // The prompt sent to model
        feedback?: string;          // Error feedback for retry
        duration: number;           // Generation time
      }>;
      finalStatus: 'passed' | 'failed';
    };
  };
  promptMd: string;                  // Challenge prompt.md content
  config: object;                    // Challenge config
}
```

## Alternative: Query Parameters

Could also add query params to existing `/api/jobs/{id}`:

```
GET /api/jobs/{id}?debug=full      # Include solutions & test output
GET /api/jobs/{id}?debug=errors    # Include only failure details
GET /api/jobs/{id}?debug=last      # Include only last attempt per model
```

## Benefits

1. **Single API call** to understand why tests failed
2. **Structured error output** with test names, expected vs received
3. **Solution inspection** without filesystem access
4. **Prompt visibility** to debug prompt engineering issues
5. **CI/CD friendly** for automated debugging pipelines

## Implementation Notes

The data already exists in `compete/debug/` - this endpoint just exposes it through the API in a structured way.

Could also consider:
- `/api/challenges/{name}/last-debug` - Most recent debug for a challenge
- Adding a `?verbose=true` param to `/api/compete` SSE events to stream solutions as they're generated

## Priority

Medium - significant DX improvement for debugging optimization challenges.
