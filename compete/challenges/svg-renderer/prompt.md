# SVG to PNG Renderer Challenge

## Competition Context

You are competing against other AI models to create the **fastest SVG to PNG rendering pipeline** for playing card generation. Your solution will be measured on:

1. **Correctness**: Output PNG must be valid and visually accurate
2. **Render Speed**: How fast can you render SVGs to PNG at various dimensions?
3. **Dimension Flexibility**: Handle different card formats efficiently
4. **Memory Efficiency**: Minimize memory allocations during rendering

## The Problem

Create a function that takes an SVG string and renders it to a PNG buffer at configurable dimensions. This is used for generating playing card images at print quality (300 DPI) for services like MakePlayingCards.com.

### Production Dimensions (Configurable)

| Format | Width | Height | Use Case |
|--------|-------|--------|----------|
| MPC Poker (default) | 816px | 1110px | Print @ 300 DPI |
| Thumbnail | 408px | 555px | Gallery previews |
| Preview | 204px | 278px | Quick previews |
| Web Display | 196px | 266px | Browser @ 72 DPI |
| Large Print | 1200px | 1632px | High-res printing |

**Important**: Dimensions come from configuration - your solution must handle any reasonable width/height combination, not just the defaults.

## Current Baseline (What You're Competing Against)

The current production implementation uses a two-stage WASM pipeline:

```typescript
// Stage 1: Satori - Element tree → SVG (uses yoga-wasm for flexbox layout)
const svg = await satori(element, { width, height, fonts })

// Stage 2: resvg - SVG → PNG (Rust WASM rasterizer)
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } })
const png = resvg.render().asPng()
```

**Why WASM?** Edge runtimes can't use native bindings (canvas, sharp). WASM provides near-native speed with cross-platform determinism.

## Required Exports (CRITICAL)

Your solution MUST export the following. Tests will fail if these are not exported.

```typescript
// REQUIRED EXPORTS - All of these must be exported with 'export' keyword

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
  renderTime: number
  memoryUsed?: number
}

export interface ElementNode {
  type: string
  props?: Record<string, any>
  children?: (ElementNode | string)[]
}

/**
 * REQUIRED: Render an SVG string to a PNG buffer
 */
export async function renderSvgToPng(
  svg: string,
  options: RenderOptions
): Promise<RenderResult>

/**
 * OPTIONAL: Render an element tree (React-like) to PNG
 */
export async function renderElementToPng(
  element: ElementNode,
  options: RenderOptions
): Promise<RenderResult>
```

**⚠️ Common Mistake**: Forgetting to add `export` keyword. The test file imports like this:
```typescript
import { renderSvgToPng, type RenderResult } from './solution'
```

If you don't export these, your solution will fail immediately.

## SVG Features That MUST Be Supported

Your renderer must handle the full SVG spec used in production:

### Basic Shapes
- `<rect>`, `<circle>`, `<ellipse>`, `<line>`, `<polyline>`, `<polygon>`
- `<path>` with all commands (M, L, H, V, C, S, Q, T, A, Z)

### Transforms
- `translate()`, `rotate()`, `scale()`, `skewX()`, `skewY()`, `matrix()`
- Nested transforms

### Text
- `<text>`, `<tspan>` elements
- Font families, sizes, weights
- Text anchoring and alignment

### Gradients & Patterns
- `<linearGradient>`, `<radialGradient>`
- Gradient stops with opacity
- `<pattern>` fills

### Advanced Features
- `<clipPath>` clipping
- `<mask>` masking
- `opacity` and `fill-opacity`
- `<image>` embedding (base64 data URIs)
- `<filter>` effects (blur, drop-shadow)
- `<use>` references

## Test Fixtures

Your solution will be tested against production SVG fixtures:

| Fixture | Size | Description |
|---------|------|-------------|
| simple.svg | 6.3 KB | Basic card with shapes, text |
| medium.svg | 6.4 KB | Card with more elements |
| complex.svg | 20.4 KB | Gradients, embedded portrait image |
| stress.svg | 23.8 KB | All SVG features combined |

Each fixture represents real playing card designs with:
- Text elements with custom fonts (16 font files available)
- Gradients (linear and radial)
- Embedded base64 images
- Complex paths and transforms
- Clipping and masking

## Performance Benchmarks

**Production baselines at 816×1110 (MPC Poker format):**

| Scenario | Current | Target | Max Allowed | Notes |
|----------|---------|--------|-------------|-------|
| Simple card (warm) | 181ms | 145ms | 223ms | After WASM init |
| Complex card | 211ms | 169ms | 260ms | Gradients + portrait |
| Stress test | 214ms | 171ms | 268ms | All features |
| Batch (10 cards) | 1890ms | 1512ms | 2267ms | Sequential |
| Cold start | 1337ms | 1070ms | 2006ms | First render, includes WASM init |

**Key insight**: Cold start is dominated by WASM initialization (~1.3s). Warm renders are ~180-215ms. Optimizing WASM init or amortizing it across renders is a major opportunity.

### Dimension Scaling

Your solution should also be tested at different dimensions:
- Small (204×278) should be faster than full size
- Large (1200×1632) will be slower but should scale linearly

## Constraints & Available Dependencies

**Runtime**: Tests run in Bun with Node.js APIs available.

**Installed packages** (you can import these directly):
- `@resvg/resvg-js` - Native Rust bindings, works out of the box ✅
- `@resvg/resvg-wasm` - WASM version (requires manual WASM init, more complex)

**Recommended**: Use `@resvg/resvg-js` - it's simpler and performs well:
```typescript
import { Resvg } from '@resvg/resvg-js'

const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } })
const png = resvg.render().asPng()
```

**Constraints**:
- Your solution must be a single TypeScript file
- All exports must use the `export` keyword
- Memory limit: Stay under 128MB memory usage
- No external network requests during rendering

## Winning Strategies

Previous winning solutions have used:
- **resvg-wasm** for high-quality SVG rasterization
- **Parallel WASM initialization** to reduce cold start
- **Caching parsed SVG structures** for repeated renders
- **Streaming PNG encoding** to reduce memory pressure
- **canvaskit-wasm** as an alternative to resvg

**Anti-patterns that hurt performance:**
- Re-initializing WASM modules per render
- Synchronous font loading
- Creating new Resvg instances unnecessarily
- Not reusing buffers

## Example Usage

```typescript
import { renderSvgToPng } from './solution'
import { readFileSync } from 'fs'

// Load a production SVG fixture
const svg = readFileSync('./fixtures/medium.svg', 'utf-8')

// Render at MPC Poker dimensions (816×1110 @ 300 DPI)
const result = await renderSvgToPng(svg, {
  width: 816,
  height: 1110
})
console.log(`Rendered in ${result.renderTime}ms, ${result.png.length} bytes`)
// Expected: ~181ms warm, ~200KB PNG

// Render same SVG as thumbnail
const thumbnail = await renderSvgToPng(svg, {
  width: 408,
  height: 555
})
console.log(`Thumbnail: ${thumbnail.renderTime}ms, ${thumbnail.png.length} bytes`)
// Expected: faster due to smaller output
```

## Previous Feedback

{{feedback}}

Good luck! May the fastest renderer win!
