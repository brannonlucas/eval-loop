# eval-loop

AI evaluation suite with two modes:
- **Promptfoo** - Standard prompt evaluations
- **Compete** - AI code competition harness (models compete to solve coding challenges)

## Quick Start (Compete)

```bash
# 1. Install dependencies
bun install

# 2. Set up API keys
cp .env.example .env
# Edit .env with your API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)

# 3. Run a competition
bun run compete -c fastest-sort
```

See [GETTING_STARTED.md](./GETTING_STARTED.md) for the full walkthrough.

## Compete System

The compete system pits AI models against each other to solve coding challenges, measuring correctness and performance.

### Running Competitions

```bash
# Basic competition (default: sonnet vs gpt4, 5 attempts each)
bun run compete -c fastest-sort

# Customize models and attempts
bun run compete -c fastest-sort -m sonnet,opus,gpt4 -a 3

# Enable refinement round (models improve on winning solution)
bun run compete -c fastest-sort --refine

# View past results
bun run compete -c fastest-sort --leaderboard

# Full help
bun run compete --help
```

### Web Dashboard

```bash
bun run serve
# Open http://localhost:3456
```

The dashboard provides:
- Real-time competition progress via SSE
- Results history and leaderboards
- Debug information for failures

### Available Models

| Model | Provider | Env Variable |
|-------|----------|--------------|
| `sonnet` | Anthropic (Claude Sonnet 4) | `ANTHROPIC_API_KEY` |
| `opus` | Anthropic (Claude Opus 4.5) | `ANTHROPIC_API_KEY` |
| `gpt4` | OpenAI (GPT-4o) | `OPENAI_API_KEY` |
| `gemini` | Google (Gemini 1.5 Pro) | `GOOGLE_API_KEY` |

### Challenge Types

- **function** - Algorithm challenges tested with vitest, benchmarked for ops/sec
- **react-component** - React components tested with Playwright for FPS and render performance

### Creating Challenges

Challenges live in `compete/challenges/<name>/`:

```
compete/challenges/my-challenge/
  prompt.md           # AI prompt template (required)
  spec.test.ts        # Correctness tests (required)
  spec.bench.ts       # Performance benchmarks (optional)
  challenge.config.json  # Custom configuration (optional)
```

See existing challenges for examples.

---

## Promptfoo Mode

Standard prompt evaluation using [Promptfoo](https://www.promptfoo.dev/).

```bash
# Run evaluations
bun run eval

# View results in browser
bun run view

# Watch mode
bun run eval:watch
```

### Structure

```
prompts/       # Prompt templates ({{variable}} syntax)
evals/         # Test case definitions (YAML)
outputs/       # Results (gitignored)
```

See [Promptfoo docs](https://www.promptfoo.dev/docs/configuration/expected-outputs) for assertion types.
