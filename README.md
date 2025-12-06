# eval-loop

LLM evaluation suite using [Promptfoo](https://www.promptfoo.dev/).

## Setup

```bash
bun install
cp .env.example .env
# Add your API keys to .env
```

## Usage

```bash
# Run evaluations
bun run eval

# View results in browser
bun run view

# Watch mode (re-run on changes)
bun run eval:watch
```

## Structure

```
prompts/       # Prompt templates ({{variable}} syntax)
evals/         # Test case definitions (YAML)
outputs/       # Results (gitignored)
```

## Adding Tests

Edit `evals/starter.yaml` or create new files in `evals/`.

See [Promptfoo docs](https://www.promptfoo.dev/docs/configuration/expected-outputs) for assertion types.
