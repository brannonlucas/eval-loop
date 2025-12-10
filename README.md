<p align="center">
  <img src="assets/logo-generated.png" alt="eval-loop logo" width="200">
</p>

<h1 align="center">eval-loop</h1>

<p align="center">
  <strong>Promptfoo</strong> - Standard prompt evaluations<br>
  <strong>Compete</strong> - AI code competition harness (models compete to solve coding challenges)
</p>

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

**New to eval-loop?** Start here:
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Full walkthrough from zero to first competition
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
- [docs/CHALLENGE_CONFIG.md](./docs/CHALLENGE_CONFIG.md) - Configuration reference
- [docs/EXAMPLES.md](./docs/EXAMPLES.md) - API client examples

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

### Web Dashboard & API Server

```bash
bun compete/server/index.ts
# Dashboard: http://localhost:3456
# API Docs:  http://localhost:3456/api/docs
```

The server provides both a web dashboard and a REST API for remote integrations.

**Dashboard features:**
- Real-time competition progress via SSE
- Results history and leaderboards
- Click any result to see full error details and re-run

**API endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/compete` | POST | Run competition (SSE stream) |
| `/api/validate` | POST | Test code against a challenge |
| `/api/generate` | POST | Generate code without competing |
| `/api/challenges` | GET | List available challenges |
| `/api/challenges` | POST | Create ad-hoc challenge |
| `/api/jobs/:id` | GET | Poll job status |
| `/api/results` | GET | Query historical results |
| `/api/schema` | GET | OpenAPI spec (for AI agents) |
| `/api/docs` | GET | Swagger UI documentation |

See [docs/EXAMPLES.md](./docs/EXAMPLES.md) for client code in JavaScript, Python, and cURL.

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

```bash
# Scaffold a new function challenge
bun run compete init my-algorithm

# Scaffold a React component challenge
bun run compete init my-component --type=react

# Link an existing repo's tests as a challenge
bun run compete link /path/to/repo my-challenge
```

Challenges live in `compete/challenges/<name>/`:

```
compete/challenges/my-challenge/
  prompt.md           # AI prompt template (required)
  spec.test.ts        # Correctness tests (required)
  spec.bench.ts       # Performance benchmarks (optional)
  challenge.config.json  # Custom configuration (optional)
```

See [docs/CHALLENGE_CONFIG.md](./docs/CHALLENGE_CONFIG.md) for all configuration options.

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
