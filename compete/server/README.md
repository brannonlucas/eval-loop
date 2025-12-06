# eval-loop HTTP API

Local HTTP server for AI code competition and validation. Call from any repository to compare AI models, test code, or run generate-and-validate workflows.

## Quick Start

```bash
# Start the server
bun run server

# Server runs at http://localhost:3456
```

## Endpoints

### Health Check

```bash
GET /api/health
```

Returns server status and active job count.

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 12345,
  "activeJobs": 0
}
```

---

### List Challenges

```bash
GET /api/challenges
```

Returns all available challenges (built-in and ad-hoc).

```json
{
  "challenges": [
    {
      "name": "virtualized-list",
      "type": "react-component",
      "path": "/path/to/challenge",
      "hasResults": true
    }
  ]
}
```

---

### Get Challenge Details

```bash
GET /api/challenges/:name
```

Returns challenge configuration, prompt, and latest results.

```json
{
  "name": "virtualized-list",
  "type": "react-component",
  "path": "/path/to/challenge",
  "hasResults": true,
  "config": {
    "type": "react-component",
    "performanceThresholds": {
      "minFPS": 55,
      "maxAvgRenderTime": 1
    }
  },
  "prompt": "# Challenge\n\nImplement a virtualized list...",
  "latestResults": { ... }
}
```

---

### Create Ad-Hoc Challenge

```bash
POST /api/challenges
Content-Type: application/json
```

Create a temporary challenge from your own test code or external repo.

**Request Body:**

```json
{
  "name": "my-feature",
  "type": "function",
  "prompt": "Implement a function that...",
  "testCode": "import { solution } from './solution';\n\ntest('works', () => { ... })"
}
```

Or reference an external repository:

```json
{
  "name": "my-feature",
  "type": "function",
  "prompt": "Implement the feature...",
  "externalRepo": {
    "path": "/Users/me/projects/my-app",
    "testPath": "src/__tests__/feature.test.ts",
    "solutionPath": "src/feature.ts"
  }
}
```

**Response:**

```json
{
  "challenge": "my-feature",
  "path": "/path/to/challenge",
  "type": "function"
}
```

---

### Validate Code

```bash
POST /api/validate
Content-Type: application/json
```

Test your code against a challenge's test suite.

**Request Body:**

```json
{
  "challenge": "fastest-sort",
  "code": "export function solution(arr: number[]): number[] { return arr.sort((a,b) => a-b) }",
  "runBenchmarks": true,
  "runPerfTests": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `challenge` | string | Yes | Challenge name |
| `code` | string | Yes | Code to test |
| `runBenchmarks` | boolean | No | Run vitest benchmarks (function challenges) |
| `runPerfTests` | boolean | No | Run Playwright perf tests (React challenges) |

**Response:**

```json
{
  "passed": true,
  "testResult": {
    "passed": true,
    "errors": [],
    "duration": 1234
  },
  "benchmarks": {
    "opsPerSecond": 1500000,
    "marginOfError": 0.5
  },
  "reactMetrics": {
    "passed": true,
    "fps": 60,
    "avgCommitTime": 0.5,
    "bundleSize": 450
  }
}
```

---

### Generate Code

```bash
POST /api/generate
Content-Type: application/json
```

Generate code with a single AI model (no testing).

**Request Body:**

```json
{
  "model": "sonnet",
  "challenge": "fastest-sort",
  "feedback": "Previous attempt failed: TypeError at line 5"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | `sonnet`, `opus`, `gpt4`, or `gemini` |
| `challenge` | string | Yes* | Challenge name (*or provide `prompt`) |
| `prompt` | string | No | Custom prompt (alternative to challenge) |
| `feedback` | string | No | Error feedback for retry attempts |

**Response:**

```json
{
  "code": "export function solution(arr: number[]): number[] { ... }",
  "model": "sonnet",
  "duration": 2500
}
```

---

### Run Competition (SSE)

```bash
POST /api/compete
Content-Type: application/json
```

Run a full competition with multiple AI models. Returns Server-Sent Events for real-time progress.

**Request Body:**

```json
{
  "challenge": "virtualized-list",
  "models": ["sonnet", "gpt4", "opus"],
  "maxAttempts": 3,
  "stream": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `challenge` | string | Yes | Challenge name |
| `models` | string[] | No | Models to compete (default: all) |
| `maxAttempts` | number | No | Max attempts per model (default: 3) |
| `stream` | boolean | No | Use SSE streaming (default: true) |

**SSE Events:**

```
event: job_created
data: {"jobId":"abc123"}

event: progress
data: {"currentModel":"sonnet","currentAttempt":1,"phase":"generating","message":"Generating solution..."}

event: model_complete
data: {"model":"sonnet","passed":true,"score":87,"attempts":1}

event: complete
data: {"results":[...]}

event: error
data: {"error":"Something went wrong"}
```

**Polling Fallback:**

If `stream: false`, returns a job ID for polling:

```json
{
  "jobId": "abc123",
  "status": "pending"
}
```

---

### Get Job Status

```bash
GET /api/jobs/:id
```

Poll job status (for non-SSE clients).

```json
{
  "jobId": "abc123",
  "status": "running",
  "progress": {
    "currentModel": "gpt4",
    "currentAttempt": 2,
    "phase": "testing",
    "completedModels": ["sonnet"],
    "message": "Running tests..."
  },
  "results": [...],
  "createdAt": "2024-01-15T10:30:00Z",
  "startedAt": "2024-01-15T10:30:01Z"
}
```

**Status Values:** `pending`, `running`, `completed`, `failed`, `cancelled`

---

### Cancel Job

```bash
DELETE /api/jobs/:id
```

Cancel a running job.

```json
{
  "cancelled": true,
  "jobId": "abc123"
}
```

---

## Usage Examples

### From Another Repository

```bash
# Validate your implementation against eval-loop's test suite
curl -X POST http://localhost:3456/api/validate \
  -H "Content-Type: application/json" \
  -d '{
    "challenge": "fastest-sort",
    "code": "'"$(cat src/my-sort.ts)"'"
  }'
```

### Create Challenge from External Repo

```bash
# Point to tests in your own project
curl -X POST http://localhost:3456/api/challenges \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-auth-feature",
    "type": "function",
    "prompt": "Implement JWT token validation...",
    "externalRepo": {
      "path": "'$(pwd)'",
      "testPath": "src/__tests__/auth.test.ts"
    }
  }'

# Now run AI models against your tests
curl -N -X POST http://localhost:3456/api/compete \
  -H "Content-Type: application/json" \
  -d '{"challenge": "my-auth-feature", "models": ["sonnet", "gpt4"]}'
```

### JavaScript/TypeScript Client

```typescript
// SSE streaming with EventSource
const eventSource = new EventSource('http://localhost:3456/api/compete', {
  // Note: EventSource doesn't support POST, use fetch for that
});

// For POST with SSE, use fetch:
const response = await fetch('http://localhost:3456/api/compete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    challenge: 'virtualized-list',
    models: ['sonnet', 'gpt4'],
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  // Parse SSE events
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log(data);
    }
  }
}
```

---

## Self-Documentation

### API Schema Endpoint

```bash
GET /api/schema
```

Returns OpenAPI 3.0 specification for machine consumption.

### TypeScript Types

All request/response types are defined in `compete/server/types.ts`.

---

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | 3456 | Server port |
| `MAX_CONCURRENT_JOBS` | 2 | Maximum parallel jobs |

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Description of what went wrong"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (missing/invalid parameters) |
| 404 | Resource not found (challenge, job) |
| 500 | Internal server error |
