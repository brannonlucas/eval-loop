# API Client Examples

Examples of programmatically interacting with the eval-loop API.

## JavaScript/TypeScript Client

### Basic Competition with Polling

```javascript
const API_URL = 'http://localhost:3456'

async function runCompetition(challenge, models = ['sonnet', 'gpt4']) {
  // Start competition
  const response = await fetch(`${API_URL}/api/compete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challenge,
      models,
      maxAttempts: 5,
    }),
  })

  const { jobId } = await response.json()
  console.log(`Started job: ${jobId}`)

  // Poll for completion
  while (true) {
    const statusRes = await fetch(`${API_URL}/api/jobs/${jobId}`)
    const job = await statusRes.json()

    console.log(`Status: ${job.status}`)

    if (job.status === 'completed' || job.status === 'failed') {
      return job
    }

    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}

// Usage
const result = await runCompetition('fastest-sort')
console.log('Results:', result.results)
```

### Server-Sent Events (SSE) Streaming

```javascript
async function runCompetitionWithStreaming(challenge, models) {
  const response = await fetch(`${API_URL}/api/compete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challenge,
      models,
      maxAttempts: 5,
      stream: true, // Enable SSE
    }),
  })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6))
        handleEvent(data)
      }
    }
  }
}

function handleEvent(event) {
  switch (event.type) {
    case 'job_started':
      console.log(`Job ${event.jobId} started`)
      break
    case 'progress':
      console.log(`${event.model}: ${event.phase} (attempt ${event.attempt})`)
      break
    case 'model_complete':
      console.log(`${event.model}: ${event.passed ? 'PASSED' : 'FAILED'}`)
      break
    case 'job_complete':
      console.log('Competition complete!')
      console.log('Results:', event.results)
      break
  }
}
```

### List Challenges

```javascript
async function listChallenges() {
  const response = await fetch(`${API_URL}/api/challenges`)
  const { challenges } = await response.json()

  console.log('Available challenges:')
  for (const c of challenges) {
    console.log(`  - ${c.name} (${c.type})`)
  }

  return challenges
}
```

### Get Challenge Details

```javascript
async function getChallengeDetail(name) {
  const response = await fetch(`${API_URL}/api/challenges/${encodeURIComponent(name)}`)
  const detail = await response.json()

  console.log(`Challenge: ${detail.name}`)
  console.log(`Type: ${detail.type}`)
  console.log(`Prompt:\n${detail.prompt}`)

  if (detail.latestResults) {
    console.log('\nLatest results:')
    for (const r of detail.latestResults.results) {
      console.log(`  ${r.model}: ${r.passed ? 'Passed' : 'Failed'}`)
    }
  }

  return detail
}
```

### Get Historical Results

```javascript
async function getResults(options = {}) {
  const params = new URLSearchParams()
  if (options.challenge) params.set('challenge', options.challenge)
  if (options.model) params.set('model', options.model)
  if (options.limit) params.set('limit', options.limit)

  const response = await fetch(`${API_URL}/api/results?${params}`)
  const { results, total } = await response.json()

  console.log(`Found ${total} results (showing ${results.length})`)
  return results
}

// Usage
const sonnetResults = await getResults({ model: 'sonnet', limit: 10 })
```

### Validate Code Without Full Competition

```javascript
async function validateCode(challenge, code) {
  const response = await fetch(`${API_URL}/api/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge, code }),
  })

  const result = await response.json()

  if (result.passed) {
    console.log('All tests passed!')
    console.log('Benchmarks:', result.benchmarks)
  } else {
    console.log('Tests failed:')
    console.log(result.errors.join('\n'))
  }

  return result
}
```

## Python Client

### Basic Competition

```python
import requests
import time

API_URL = 'http://localhost:3456'

def run_competition(challenge, models=['sonnet', 'gpt4']):
    # Start competition
    response = requests.post(f'{API_URL}/api/compete', json={
        'challenge': challenge,
        'models': models,
        'maxAttempts': 5,
    })
    job_id = response.json()['jobId']
    print(f'Started job: {job_id}')

    # Poll for completion
    while True:
        status = requests.get(f'{API_URL}/api/jobs/{job_id}').json()
        print(f'Status: {status["status"]}')

        if status['status'] in ('completed', 'failed'):
            return status

        time.sleep(2)

# Usage
result = run_competition('fastest-sort')
print('Results:', result['results'])
```

### With SSE Streaming

```python
import requests
import json

def run_competition_streaming(challenge, models):
    response = requests.post(
        f'{API_URL}/api/compete',
        json={
            'challenge': challenge,
            'models': models,
            'maxAttempts': 5,
            'stream': True,
        },
        stream=True
    )

    for line in response.iter_lines():
        if line:
            line = line.decode('utf-8')
            if line.startswith('data: '):
                event = json.loads(line[6:])
                handle_event(event)

def handle_event(event):
    event_type = event.get('type')
    if event_type == 'progress':
        print(f"{event['model']}: {event['phase']}")
    elif event_type == 'model_complete':
        status = 'PASSED' if event['passed'] else 'FAILED'
        print(f"{event['model']}: {status}")
    elif event_type == 'job_complete':
        print('Competition complete!')
```

## cURL Examples

### Start Competition

```bash
curl -X POST http://localhost:3456/api/compete \
  -H 'Content-Type: application/json' \
  -d '{
    "challenge": "fastest-sort",
    "models": ["sonnet", "gpt4"],
    "maxAttempts": 5
  }'
```

### Check Job Status

```bash
curl http://localhost:3456/api/jobs/JOB_ID_HERE
```

### List Challenges

```bash
curl http://localhost:3456/api/challenges
```

### Get Results

```bash
# All results
curl http://localhost:3456/api/results

# Filtered by challenge
curl 'http://localhost:3456/api/results?challenge=fastest-sort'

# Filtered by model
curl 'http://localhost:3456/api/results?model=sonnet&limit=10'
```

### Health Check

```bash
curl http://localhost:3456/api/health
```

## API Reference

Full API documentation available at:
- Swagger UI: http://localhost:3456/api/docs
- OpenAPI Schema: http://localhost:3456/api/schema

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (job started) |
| 400 | Bad request (invalid params) |
| 404 | Not found |
| 500 | Server error |
