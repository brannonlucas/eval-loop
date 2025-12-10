# Troubleshooting Guide

Common issues and solutions for the eval-loop competition system.

## API Key Issues

### "Missing API keys" error

```
Missing API keys:
  - ANTHROPIC_API_KEY (Anthropic): https://console.anthropic.com/
```

**Solution**: Add the required API keys to your `.env` file:

```bash
# Copy the example and fill in your keys
cp .env.example .env
```

Required keys depend on which models you're using:
- `ANTHROPIC_API_KEY` - For Sonnet and Opus models
- `OPENAI_API_KEY` - For GPT-4 model
- `GOOGLE_API_KEY` - For Gemini model

### API key is set but still getting errors

1. Check there are no extra spaces or quotes around the key
2. Verify the key is active in your provider's dashboard
3. Check you have sufficient credits/quota

## Challenge Validation Errors

### "Challenge directory not found"

```
Challenge validation failed:
  - Challenge directory not found: compete/challenges/my-challenge
```

**Solution**: Create the challenge or check the spelling:

```bash
# List available challenges
ls compete/challenges/

# Create a new challenge
bun run compete init my-challenge
```

### "Missing prompt.md"

```
Challenge validation failed:
  - Missing prompt.md - this file defines the challenge for AI models
```

**Solution**: Every challenge needs a `prompt.md` file that describes what the AI should build:

```bash
# Create from template
bun run compete init my-challenge

# Or manually create
echo "# Challenge: My Challenge\n\nWrite a function that..." > compete/challenges/my-challenge/prompt.md
```

### "Missing spec.test.ts"

```
Challenge validation failed:
  - Missing spec.test.ts or spec.test.tsx
```

**Solution**: Add a test file to verify AI solutions:

```bash
# For function challenges: spec.test.ts
# For React challenges: spec.test.tsx
```

## External Repository Issues

### "External repo path not found"

```
Challenge validation failed:
  - External repo path not found: /path/to/repo
```

**Solution**:
1. Check the path exists
2. Use absolute paths in `challenge.config.json`
3. Re-run the link command:

```bash
bun run compete link /correct/path my-challenge
```

### "External test file not found"

```
External test file not found: src/__tests__/my.test.ts
```

**Solution**: The `testPath` in your config is relative to the external repo root. Verify:

```bash
# Check the file exists
ls /path/to/repo/src/__tests__/my.test.ts
```

### "Cannot find module" during external repo tests

Tests can't find dependencies from the external repo.

**Solution**: Add the missing files to `copyPaths` in `challenge.config.json`:

```json
{
  "externalRepo": {
    "path": "/path/to/repo",
    "testPath": "src/__tests__/my.test.ts",
    "solutionPath": "src/solution.ts",
    "copyPaths": [
      "src/types.ts",
      "src/utils/",
      "src/constants.ts"
    ]
  }
}
```

## Test Failures

### Tests pass locally but fail in competition

1. **Import paths**: AI solutions use relative imports. Check your test imports from `./solution`
2. **Missing dependencies**: Ensure all required types/utilities are available
3. **Environment differences**: The competition runs in an isolated workspace

### "Failed after N attempts"

The AI couldn't generate passing code within the attempt limit.

**Solutions**:
1. Improve your `prompt.md` with clearer requirements
2. Add examples to the prompt
3. Increase `maxAttempts` (default: 5)
4. Check if the test expectations are reasonable

### Benchmarks show 0 ops/sec

The benchmark may be failing silently.

**Solution**: Check `spec.bench.ts` for errors:

```bash
# Run benchmark directly
bun test compete/challenges/my-challenge/spec.bench.ts
```

## Dashboard Issues

### Dashboard won't load

```
bun compete/server/index.ts
# Navigate to http://localhost:3456
```

**Check**:
1. Port 3456 isn't in use
2. No firewall blocking localhost
3. Try a different browser

### Results not appearing

1. Wait for the competition to complete
2. Check `compete/results/` for JSON files
3. Refresh the Results page

### "Failed to start competition" in dashboard

Check the terminal running the server for detailed errors. Common causes:
- Missing API keys
- Invalid challenge name
- Challenge validation errors

## Performance Issues

### Competition is very slow

**Solutions**:
1. Reduce `maxAttempts` for initial testing
2. Use fewer models: `-m sonnet` instead of all models
3. Check your API rate limits

### Workspace cleanup warnings

Old workspaces are automatically cleaned up. If you see warnings:

```bash
# Manual cleanup
rm -rf compete/.tmp/*
```

## Getting More Help

### Enable debug output

```bash
# Set environment variable
DEBUG=1 bun run compete -c my-challenge
```

### Check debug artifacts

After a failed run, check:
- `compete/debug/` - Vitest JSON output
- `compete/results/` - Competition results with error messages

### View full error in dashboard

1. Go to Results tab
2. Click any row to expand it
3. Full error message is shown in the detail panel

## Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| `ENOENT` | File not found | Check paths in config |
| `EACCES` | Permission denied | Check file permissions |
| `ETIMEDOUT` | API timeout | Check internet, retry |
| `429 Too Many Requests` | Rate limited | Wait and retry |
| `401 Unauthorized` | Invalid API key | Check key in .env |
