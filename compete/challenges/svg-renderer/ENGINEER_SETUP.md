# SVG Renderer Challenge - Engineer Setup Guide

This document explains how to integrate your production SVG renderer into the eval-loop competition framework for benchmarking and optimization.

## Overview

We've created a competition challenge that tests SVG → PNG rendering performance. To make the tests realistic, we need:

1. **Sample SVGs** from your production system
2. **Your current implementation** (the Satori + resvg pipeline)
3. **Performance baselines** (what are acceptable render times?)

---

## What We Need From You

### 1. Sample SVG Fixtures

Export 3-5 representative SVGs from your production system at different complexity levels:

| Complexity | Description | Example |
|------------|-------------|---------|
| **Simple** | Basic card with minimal elements | Single suit, solid colors |
| **Medium** | Typical card render | Standard playing card |
| **Complex** | Full-featured card | Gradients, text, filters, shadows |
| **Stress test** | Worst-case scenario | Most complex card possible |

**How to export:**

```typescript
// In your render-worker.ts or wherever you generate SVGs
// After satori() but before resvg(), log the SVG:

const svg = await satori(element, { width, height, fonts })
console.log('--- SVG FIXTURE ---')
console.log(svg)
console.log('--- END FIXTURE ---')
```

Save each SVG to a file named by complexity:
- `fixtures/simple.svg`
- `fixtures/medium.svg`
- `fixtures/complex.svg`
- `fixtures/stress.svg`

### 2. Your Current Implementation

We need your `renderSvgToPng` function adapted to this interface:

```typescript
export interface RenderOptions {
  width: number
  height: number
  fonts?: FontConfig[]
}

export interface FontConfig {
  name: string
  data: ArrayBuffer
  weight?: number
  style?: 'normal' | 'italic'
}

export interface RenderResult {
  png: Uint8Array
  renderTime: number      // ms to render
  memoryUsed?: number     // optional: bytes used
}

export async function renderSvgToPng(
  svg: string,
  options: RenderOptions
): Promise<RenderResult>
```

**Your current code (adapt this):**

```typescript
// Current production code:
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } })
const png = resvg.render().asPng()

// Adapt to return RenderResult:
export async function renderSvgToPng(
  svg: string,
  options: RenderOptions
): Promise<RenderResult> {
  const start = performance.now()

  // Your existing logic here
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: options.width }
  })
  const png = resvg.render().asPng()

  return {
    png,
    renderTime: performance.now() - start,
  }
}
```

### 3. Font Files (if using custom fonts)

If your cards use custom fonts, we need them for accurate testing:

```
fixtures/fonts/
├── your-font-regular.ttf
├── your-font-bold.ttf
└── ...
```

### 4. Performance Expectations

Fill in your current performance baselines:

| Scenario | Current Avg | Target | Acceptable Max |
|----------|-------------|--------|----------------|
| Simple card | ___ms | ___ms | ___ms |
| Complex card | ___ms | ___ms | ___ms |
| Batch (10 cards) | ___ms | ___ms | ___ms |
| Cold start (first render) | ___ms | ___ms | ___ms |

---

## File Structure

Place your files in the challenge directory:

```
compete/challenges/svg-renderer/
├── fixtures/                    # ADD THIS
│   ├── simple.svg
│   ├── medium.svg
│   ├── complex.svg
│   ├── stress.svg
│   └── fonts/
│       └── *.ttf
├── production-solution.ts       # ADD THIS (your implementation)
├── spec.test.ts                 # We'll update to use your fixtures
├── spec.bench.ts                # We'll update to use your fixtures
├── solution.ts                  # Baseline for comparison
├── prompt.md                    # Challenge spec
└── challenge.config.json        # Config
```

---

## How Tests Will Use Your Fixtures

Once you provide the SVGs, we'll update the tests like this:

```typescript
// spec.test.ts
import { readFileSync } from 'fs'
import { join } from 'path'

// Load your production SVGs
const FIXTURES_DIR = join(__dirname, 'fixtures')
const SVG_SIMPLE = readFileSync(join(FIXTURES_DIR, 'simple.svg'), 'utf-8')
const SVG_COMPLEX = readFileSync(join(FIXTURES_DIR, 'complex.svg'), 'utf-8')

describe('Production SVG Rendering', () => {
  it('should render simple card under 50ms', async () => {
    const result = await renderSvgToPng(SVG_SIMPLE, { width: 250, height: 350 })
    expect(result.renderTime).toBeLessThan(50)
  })

  it('should render complex card under 200ms', async () => {
    const result = await renderSvgToPng(SVG_COMPLEX, { width: 250, height: 350 })
    expect(result.renderTime).toBeLessThan(200)
  })
})
```

---

## Quick Validation

Before submitting, verify your SVGs render correctly:

```bash
# From eval-loop directory
bun test compete/challenges/svg-renderer/spec.test.ts
```

All tests should pass. If they fail, check:
- SVG has valid XML structure
- All fonts are embedded or provided
- Image data URIs are complete (not truncated)

---

## Questions?

If anything is unclear:
1. What dimensions are your cards? (we assumed 250x350)
2. Do you use any SVG features not listed? (filters, masks, animations?)
3. Are there edge cases that cause slow renders?
4. What's your WASM initialization strategy? (per-request vs singleton?)

---

## Deliverables Checklist

- [ ] `fixtures/simple.svg` - Simple card SVG
- [ ] `fixtures/medium.svg` - Medium complexity SVG
- [ ] `fixtures/complex.svg` - Complex card SVG
- [ ] `fixtures/stress.svg` - Stress test SVG
- [ ] `fixtures/fonts/*.ttf` - Any custom fonts used
- [ ] `production-solution.ts` - Your implementation adapted to interface
- [ ] Performance baselines filled in above
- [ ] Card dimensions confirmed
