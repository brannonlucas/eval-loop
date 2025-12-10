# Challenge Configuration Reference

Complete reference for `challenge.config.json` options.

## Overview

Each challenge can have an optional `challenge.config.json` file that customizes its behavior. If omitted, defaults are used based on auto-detected challenge type.

## File Location

```
compete/challenges/<name>/
├── challenge.config.json   # Optional configuration
├── prompt.md               # Required: AI prompt
├── spec.test.ts(x)         # Required: Correctness tests
├── spec.bench.ts           # Optional: Performance benchmarks
└── solution.ts(x)          # Generated: AI solution
```

## Schema

```typescript
interface ChallengeConfig {
  // Challenge type determines which runner to use
  type: 'function' | 'react-component'

  // Display name (defaults to directory name)
  name?: string

  // Time limit for AI generation in milliseconds
  generationTimeout?: number

  // Maximum retry attempts for failed tests
  maxRetries?: number

  // Performance thresholds (React components only)
  performanceThresholds?: PerformanceThresholds

  // External repository configuration
  externalRepo?: ExternalRepoConfig
}
```

## Properties

### `type` (required)

Challenge type determines which test runner and metrics to use.

| Value | Description | Test File | Metrics |
|-------|-------------|-----------|---------|
| `function` | Algorithm/utility function | `spec.test.ts` | Operations per second |
| `react-component` | React component | `spec.test.tsx` | FPS, render count |

```json
{
  "type": "function"
}
```

### `name` (optional)

Display name for results and dashboard. Defaults to the directory name.

```json
{
  "name": "Fastest Sorting Algorithm"
}
```

### `generationTimeout` (optional)

Maximum time (in milliseconds) to wait for AI to generate a solution.

| Type | Default |
|------|---------|
| `function` | 60000 (1 minute) |
| `react-component` | 90000 (1.5 minutes) |

```json
{
  "generationTimeout": 120000
}
```

### `maxRetries` (optional)

Maximum number of retry attempts when tests fail. Each retry includes the previous error as feedback.

**Default**: 3

```json
{
  "maxRetries": 5
}
```

### `performanceThresholds` (optional)

Performance requirements for React component challenges. Solutions must meet these thresholds to pass.

```json
{
  "performanceThresholds": {
    "minFps": 55,
    "maxRenderCount": 100,
    "maxBundleSize": 5120,
    "maxMemoryGrowth": 10485760
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `minFps` | number | 55 | Minimum acceptable FPS (p95) during interaction |
| `maxRenderCount` | number | 100 | Maximum render count during test scenario |
| `maxBundleSize` | number | 5120 | Maximum bundle size in bytes (gzipped) |
| `maxMemoryGrowth` | number | - | Maximum memory growth in bytes |

### `externalRepo` (optional)

Configuration for testing against an external repository. Use this when you want AI models to write code that passes tests in a separate project.

```json
{
  "externalRepo": {
    "path": "/absolute/path/to/repo",
    "testPath": "src/__tests__/my-feature.test.ts",
    "solutionPath": "src/my-feature.ts",
    "copyPaths": [
      "src/types.ts",
      "src/utils/"
    ]
  }
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `path` | string | Yes | Absolute path to the external repository |
| `testPath` | string | Yes | Test file path relative to repo root |
| `solutionPath` | string | Yes | Where AI solution should be written |
| `copyPaths` | string[] | No | Additional files/directories needed for tests |

## Examples

### Minimal Function Challenge

```json
{
  "type": "function"
}
```

### React Component with Custom Thresholds

```json
{
  "type": "react-component",
  "name": "High-Performance List",
  "performanceThresholds": {
    "minFps": 60,
    "maxRenderCount": 50,
    "maxBundleSize": 3072
  }
}
```

### External Repository Challenge

```json
{
  "type": "function",
  "name": "API Client",
  "externalRepo": {
    "path": "/Users/dev/projects/my-api-client",
    "testPath": "tests/client.test.ts",
    "solutionPath": "src/client.ts",
    "copyPaths": [
      "src/types.ts",
      "src/constants.ts",
      "tests/fixtures/"
    ]
  },
  "generationTimeout": 90000,
  "maxRetries": 5
}
```

### Long-Running Algorithm Challenge

```json
{
  "type": "function",
  "name": "Complex Algorithm",
  "generationTimeout": 180000,
  "maxRetries": 10
}
```

## Auto-Detection

If no `challenge.config.json` exists, the system auto-detects the challenge type:

1. If `solution.tsx` exists → `react-component`
2. If `spec.test.tsx` exists → `react-component`
3. Otherwise → `function`

## Validation

The system validates challenges before running:

1. **Required files**: `prompt.md`, `spec.test.ts(x)`
2. **External repo paths**: Must exist and be accessible
3. **Type consistency**: File extensions should match declared type

Validation errors are shown before the competition starts, allowing you to fix issues without wasting API calls.

## CLI Commands

```bash
# Create challenge from template (auto-generates config)
bun run compete init my-challenge --type=function

# Link external repo (generates config automatically)
bun run compete link /path/to/repo my-challenge

# Validate challenge without running
bun run compete -c my-challenge --validate
```
