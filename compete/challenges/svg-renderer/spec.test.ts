import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSvgToPng, type RenderResult } from './solution'

// Dimension configs - not hardcoded, can vary based on card format
const DIMENSIONS = {
  // MPC Poker format @ 300 DPI (current production default)
  mpcPoker: { width: 816, height: 1110 },
  // Half size for thumbnails
  thumbnail: { width: 408, height: 555 },
  // Quarter size for previews
  preview: { width: 204, height: 278 },
  // Standard poker @ 72 DPI (web display)
  webDisplay: { width: 196, height: 266 },
  // Large format
  largePrint: { width: 1200, height: 1632 },
}

// Default test dimensions (can be changed via config)
const DEFAULT_DIMS = DIMENSIONS.mpcPoker

// Load production fixtures (compatible with both Bun and Vitest/Node)
const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, 'fixtures')
const SVG_SIMPLE = readFileSync(join(FIXTURES_DIR, 'simple.svg'), 'utf-8')
const SVG_MEDIUM = readFileSync(join(FIXTURES_DIR, 'medium.svg'), 'utf-8')
const SVG_COMPLEX = readFileSync(join(FIXTURES_DIR, 'complex.svg'), 'utf-8')
const SVG_STRESS = readFileSync(join(FIXTURES_DIR, 'stress.svg'), 'utf-8')

// Performance thresholds from production baselines
const THRESHOLDS = {
  simple: { target: 145, max: 223 },
  complex: { target: 169, max: 260 },
  stress: { target: 171, max: 268 },
  batch10: { target: 1512, max: 2267 },
  coldStart: { target: 1070, max: 2006 },
}

describe('SVG Renderer - Correctness', () => {
  describe('Basic Rendering', () => {
    it('should render simple card SVG', async () => {
      const result = await renderSvgToPng(SVG_SIMPLE, {
        ...DEFAULT_DIMS,
      })

      expect(result).toBeDefined()
      expect(result.png).toBeInstanceOf(Uint8Array)
      expect(result.png.length).toBeGreaterThan(0)
      expect(result.renderTime).toBeGreaterThanOrEqual(0)
    })

    it('should render medium complexity card', async () => {
      const result = await renderSvgToPng(SVG_MEDIUM, {
        ...DEFAULT_DIMS,
      })

      expect(result.png).toBeInstanceOf(Uint8Array)
      expect(result.png.length).toBeGreaterThan(1000)
    })

    it('should render complex card with gradients', async () => {
      const result = await renderSvgToPng(SVG_COMPLEX, {
        ...DEFAULT_DIMS,
      })

      expect(result.png).toBeInstanceOf(Uint8Array)
      expect(result.png.length).toBeGreaterThan(10000)
    })

    it('should render stress test card', async () => {
      const result = await renderSvgToPng(SVG_STRESS, {
        ...DEFAULT_DIMS,
      })

      expect(result.png).toBeInstanceOf(Uint8Array)
      expect(result.png.length).toBeGreaterThan(10000)
    })

    it('should produce valid PNG header', async () => {
      const result = await renderSvgToPng(SVG_SIMPLE, {
        ...DEFAULT_DIMS,
      })

      // PNG magic bytes: 137 80 78 71 13 10 26 10
      const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]
      const header = Array.from(result.png.slice(0, 8))
      expect(header).toEqual(pngSignature)
    })
  })

  describe('Dimension Handling', () => {
    it('should respect width option for scaling', async () => {
      const result = await renderSvgToPng(SVG_SIMPLE, DEFAULT_DIMS)

      // Should produce a reasonably sized PNG for full-size card
      // Simple SVG produces ~14KB, complex produces ~200KB+
      expect(result.png.length).toBeGreaterThan(10 * 1024)
    })

    it('should handle smaller output dimensions', async () => {
      const result = await renderSvgToPng(SVG_SIMPLE, DIMENSIONS.thumbnail)

      expect(result.png).toBeInstanceOf(Uint8Array)
      expect(result.png.length).toBeGreaterThan(0)
    })

    it('should handle various dimension configs', async () => {
      // Test multiple dimension configs work correctly
      for (const [name, dims] of Object.entries(DIMENSIONS)) {
        const result = await renderSvgToPng(SVG_SIMPLE, dims)
        expect(result.png).toBeInstanceOf(Uint8Array)
        expect(result.png.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle SVG with embedded images', async () => {
      // Complex SVG has embedded portrait image
      const result = await renderSvgToPng(SVG_COMPLEX, {
        ...DEFAULT_DIMS,
      })

      expect(result.png).toBeInstanceOf(Uint8Array)
    })

    it('should handle SVG with text elements', async () => {
      // All fixtures have text elements
      const result = await renderSvgToPng(SVG_MEDIUM, {
        ...DEFAULT_DIMS,
      })

      expect(result.png).toBeInstanceOf(Uint8Array)
    })

    it('should handle SVG with gradients and filters', async () => {
      // Complex and stress SVGs have gradients
      const result = await renderSvgToPng(SVG_STRESS, {
        ...DEFAULT_DIMS,
      })

      expect(result.png).toBeInstanceOf(Uint8Array)
    })
  })
})

describe('SVG Renderer - Performance', () => {
  // Note: First test includes cold start time
  // Subsequent tests measure warm render time

  it('should render simple card under max threshold', async () => {
    const result = await renderSvgToPng(SVG_SIMPLE, DEFAULT_DIMS)

    // Use max threshold to account for CI variance
    // Cold start is much higher, so skip this for first render
    expect(result.renderTime).toBeLessThan(THRESHOLDS.coldStart.max)
  })

  it('should render simple card at warm speed', async () => {
    // Warm up first
    await renderSvgToPng(SVG_SIMPLE, DEFAULT_DIMS)

    // Measure warm render
    const result = await renderSvgToPng(SVG_SIMPLE, DEFAULT_DIMS)

    expect(result.renderTime).toBeLessThan(THRESHOLDS.simple.max)
  })

  it('should render complex card under max threshold', async () => {
    const result = await renderSvgToPng(SVG_COMPLEX, DEFAULT_DIMS)

    expect(result.renderTime).toBeLessThan(THRESHOLDS.complex.max)
  })

  it('should render stress test card under max threshold', async () => {
    const result = await renderSvgToPng(SVG_STRESS, DEFAULT_DIMS)

    expect(result.renderTime).toBeLessThan(THRESHOLDS.stress.max)
  })

  it('should render batch of 10 cards under max threshold', async () => {
    const start = performance.now()

    for (let i = 0; i < 10; i++) {
      await renderSvgToPng(SVG_MEDIUM, {
        ...DEFAULT_DIMS,
      })
    }

    const totalTime = performance.now() - start
    expect(totalTime).toBeLessThan(THRESHOLDS.batch10.max)
  })

  it('should report render time accurately', async () => {
    const result = await renderSvgToPng(SVG_SIMPLE, DEFAULT_DIMS)

    // renderTime should be a positive number in milliseconds
    expect(result.renderTime).toBeGreaterThan(0)
    expect(typeof result.renderTime).toBe('number')
    expect(Number.isFinite(result.renderTime)).toBe(true)
  })
})

describe('SVG Renderer - Output Quality', () => {
  it('should produce consistent output for same input', async () => {
    const result1 = await renderSvgToPng(SVG_SIMPLE, DEFAULT_DIMS)

    const result2 = await renderSvgToPng(SVG_SIMPLE, DEFAULT_DIMS)

    // PNG output should be byte-identical for same input
    expect(result1.png.length).toBe(result2.png.length)
    expect(Buffer.from(result1.png).equals(Buffer.from(result2.png))).toBe(true)
  })

  it('should produce different output for different inputs', async () => {
    const result1 = await renderSvgToPng(SVG_SIMPLE, DEFAULT_DIMS)

    const result2 = await renderSvgToPng(SVG_COMPLEX, DEFAULT_DIMS)

    // Different SVGs should produce different PNGs
    expect(result1.png.length).not.toBe(result2.png.length)
  })
})
