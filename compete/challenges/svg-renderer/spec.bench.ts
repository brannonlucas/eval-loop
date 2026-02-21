import { bench, describe } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSvgToPng } from './solution'

// Load production fixtures (compatible with both Bun and Vitest/Node)
const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, 'fixtures')
const SVG_SIMPLE = readFileSync(join(FIXTURES_DIR, 'simple.svg'), 'utf-8')
const SVG_MEDIUM = readFileSync(join(FIXTURES_DIR, 'medium.svg'), 'utf-8')
const SVG_COMPLEX = readFileSync(join(FIXTURES_DIR, 'complex.svg'), 'utf-8')
const SVG_STRESS = readFileSync(join(FIXTURES_DIR, 'stress.svg'), 'utf-8')

// Common card dimension configs
const DIMENSIONS = {
  // MPC Poker format @ 300 DPI (production default)
  mpcPoker: { width: 816, height: 1110 },
  // Half size for thumbnails
  thumbnail: { width: 408, height: 555 },
  // Quarter size for previews
  preview: { width: 204, height: 278 },
  // Standard poker size @ 72 DPI (web display)
  webDisplay: { width: 196, height: 266 },
  // Large format for print
  largePrint: { width: 1200, height: 1632 },
}

describe('SVG Renderer Benchmarks - Production Fixtures', () => {
  // Standard production dimensions (816×1110)
  describe('MPC Poker Format (816×1110)', () => {
    bench('simple card', async () => {
      await renderSvgToPng(SVG_SIMPLE, DIMENSIONS.mpcPoker)
    })

    bench('medium card', async () => {
      await renderSvgToPng(SVG_MEDIUM, DIMENSIONS.mpcPoker)
    })

    bench('complex card (gradients + portrait)', async () => {
      await renderSvgToPng(SVG_COMPLEX, DIMENSIONS.mpcPoker)
    })

    bench('stress test card (all features)', async () => {
      await renderSvgToPng(SVG_STRESS, DIMENSIONS.mpcPoker)
    })
  })

  // Batch rendering
  describe('Batch Rendering', () => {
    bench('batch 10 medium cards (sequential)', async () => {
      for (let i = 0; i < 10; i++) {
        await renderSvgToPng(SVG_MEDIUM, DIMENSIONS.mpcPoker)
      }
    })

    bench('batch 10 medium cards (parallel)', async () => {
      await Promise.all(
        Array.from({ length: 10 }, () =>
          renderSvgToPng(SVG_MEDIUM, DIMENSIONS.mpcPoker)
        )
      )
    })

    bench('batch 5 complex cards (sequential)', async () => {
      for (let i = 0; i < 5; i++) {
        await renderSvgToPng(SVG_COMPLEX, DIMENSIONS.mpcPoker)
      }
    })
  })

  // Different dimension configs
  describe('Dimension Flexibility', () => {
    bench('thumbnail (408×555)', async () => {
      await renderSvgToPng(SVG_MEDIUM, DIMENSIONS.thumbnail)
    })

    bench('preview (204×278)', async () => {
      await renderSvgToPng(SVG_MEDIUM, DIMENSIONS.preview)
    })

    bench('web display (196×266)', async () => {
      await renderSvgToPng(SVG_MEDIUM, DIMENSIONS.webDisplay)
    })

    bench('large print (1200×1632)', async () => {
      await renderSvgToPng(SVG_MEDIUM, DIMENSIONS.largePrint)
    })
  })

  // Scaling impact
  describe('Scaling Performance Impact', () => {
    bench('same SVG → small output (204px)', async () => {
      await renderSvgToPng(SVG_COMPLEX, { width: 204, height: 278 })
    })

    bench('same SVG → medium output (408px)', async () => {
      await renderSvgToPng(SVG_COMPLEX, { width: 408, height: 555 })
    })

    bench('same SVG → large output (816px)', async () => {
      await renderSvgToPng(SVG_COMPLEX, { width: 816, height: 1110 })
    })

    bench('same SVG → extra large output (1200px)', async () => {
      await renderSvgToPng(SVG_COMPLEX, { width: 1200, height: 1632 })
    })
  })

  // SVG complexity comparison at same dimensions
  describe('Complexity Comparison (same dimensions)', () => {
    const dims = DIMENSIONS.mpcPoker

    bench('simple SVG (6.3 KB)', async () => {
      await renderSvgToPng(SVG_SIMPLE, dims)
    })

    bench('medium SVG (6.4 KB)', async () => {
      await renderSvgToPng(SVG_MEDIUM, dims)
    })

    bench('complex SVG (20.4 KB)', async () => {
      await renderSvgToPng(SVG_COMPLEX, dims)
    })

    bench('stress SVG (23.8 KB)', async () => {
      await renderSvgToPng(SVG_STRESS, dims)
    })
  })
})
