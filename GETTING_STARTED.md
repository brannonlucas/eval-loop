# Getting Started with Eval-Loop Compete

This guide walks you through running your first AI code competition.

## Prerequisites

- [Bun](https://bun.sh/) runtime installed
- At least one AI provider API key (Anthropic, OpenAI, or Google)

## Step 1: Install Dependencies

```bash
git clone <repo-url>
cd eval-loop
bun install
```

## Step 2: Configure API Keys

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```bash
# Required for Claude models (sonnet, opus)
ANTHROPIC_API_KEY=sk-ant-...

# Required for GPT-4 model
OPENAI_API_KEY=sk-...

# Required for Gemini model (optional)
GOOGLE_API_KEY=AIza...
```

You only need keys for the models you want to use. For example, if you only want to run Claude models, you only need `ANTHROPIC_API_KEY`.

### Where to Get API Keys

| Provider | Model(s) | Get Key At |
|----------|----------|------------|
| Anthropic | sonnet, opus | https://console.anthropic.com/ |
| OpenAI | gpt4 | https://platform.openai.com/api-keys |
| Google | gemini | https://makersuite.google.com/app/apikey |

## Step 3: Run Your First Competition

Run the built-in `fastest-sort` challenge:

```bash
bun run compete -c fastest-sort
```

This will:
1. Load the challenge prompt
2. Ask each model (default: sonnet, gpt4) to generate a solution
3. Run tests to verify correctness
4. If tests pass, run benchmarks to measure performance
5. Save results to `compete/results/fastest-sort.json`

### Understanding the Output

```
=== Running Competition: fastest-sort ===
Type: function
Models: sonnet, gpt4
Max attempts per model: 5

--- SONNET ---
Attempt 1/5...
  Generating solution...
  Running tests...
  Tests PASSED!
  Running benchmarks...
  Completed in 1 attempt(s)

--- GPT4 ---
Attempt 1/5...
  Generating solution...
  Running tests...
  Tests PASSED!
  Running benchmarks...
  Completed in 1 attempt(s)

=== Competition Results ===
...
```

## Step 4: Customize Your Competition

### Use Different Models

```bash
# Single model
bun run compete -c fastest-sort -m opus

# Multiple models
bun run compete -c fastest-sort -m sonnet,opus,gpt4,gemini
```

### Adjust Attempt Count

Models get multiple attempts to pass tests. Adjust with `-a`:

```bash
# Only 1 attempt (strict)
bun run compete -c fastest-sort -a 1

# Up to 10 attempts (lenient)
bun run compete -c fastest-sort -a 10
```

### Enable Refinement Round

After the initial competition, models can try to improve on the winning solution:

```bash
bun run compete -c fastest-sort --refine
```

## Step 5: View Results

### Command Line Leaderboard

```bash
bun run compete -c fastest-sort --leaderboard
```

### Web Dashboard

Start the dashboard server:

```bash
bun run serve
```

Open http://localhost:3456 in your browser to see:
- Real-time competition progress
- Historical results
- Debug information for failures

## Available Challenges

List existing challenges:

```bash
ls compete/challenges/
```

Common challenges:
- `fastest-sort` - Implement a fast sorting algorithm
- `virtualized-list` - Build a performant React virtualized list
- `basic-calculator` - Parse and evaluate math expressions

## Creating Your Own Challenge

Create a new directory in `compete/challenges/`:

```
compete/challenges/my-challenge/
  prompt.md           # Instructions for the AI
  spec.test.ts        # Vitest tests for correctness
  spec.bench.ts       # Optional: benchmarks for performance
```

### Minimal Example

**prompt.md:**
```markdown
# Challenge: Add Two Numbers

Write a TypeScript function that adds two numbers.

## Requirements
- Export a function named `add`
- Takes two number parameters
- Returns their sum

## Example
```typescript
add(2, 3) // returns 5
```

## Previous Feedback
{{feedback}}
```

**spec.test.ts:**
```typescript
import { describe, it, expect } from 'vitest'
import { add } from './solution'

describe('add', () => {
  it('adds positive numbers', () => {
    expect(add(2, 3)).toBe(5)
  })
  
  it('adds negative numbers', () => {
    expect(add(-1, -2)).toBe(-3)
  })
})
```

Run it:
```bash
bun run compete -c my-challenge
```

## Troubleshooting

### "Missing API key" Error

Make sure you've:
1. Created a `.env` file from `.env.example`
2. Added valid API keys for the models you're using
3. Keys don't have extra spaces or quotes

### "Challenge validation failed" Error

Check that your challenge directory has:
- `prompt.md` - Required for all challenges
- `spec.test.ts` or `spec.test.tsx` - Required for testing

### Tests Keep Failing

- Increase attempts: `-a 10`
- Check that your tests are correct by running them manually
- Review the error messages in the output

### Need More Help?

```bash
bun run compete --help
```

See also:
- [Server API Documentation](./compete/server/README.md)
- Existing challenges in `compete/challenges/` for examples
