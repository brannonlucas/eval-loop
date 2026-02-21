#!/usr/bin/env bun
/**
 * Benchmark script for measuring SVG → PNG render performance.
 *
 * Run: bun run benchmark.ts
 *
 * This measures:
 * - Cold start (first render, includes WASM init)
 * - Warm renders (subsequent renders)
 * - Batch throughput (10 cards in sequence)
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderSvgToPng, renderBatch } from './production-solution'

const FIXTURES_DIR = join(import.meta.dir, 'fixtures')

// Load fixtures
const fixtures = {
  simple: readFileSync(join(FIXTURES_DIR, 'simple.svg'), 'utf-8'),
  medium: readFileSync(join(FIXTURES_DIR, 'medium.svg'), 'utf-8'),
  complex: readFileSync(join(FIXTURES_DIR, 'complex.svg'), 'utf-8'),
  stress: readFileSync(join(FIXTURES_DIR, 'stress.svg'), 'utf-8'),
}

// Card dimensions from Sovereign Decks production config
const CARD_WIDTH = 816
const CARD_HEIGHT = 1110

interface BenchmarkResult {
  fixture: string
  coldStart: number
  warmAvg: number
  warmMin: number
  warmMax: number
  iterations: number
}

async function benchmarkFixture(
  name: string,
  svg: string,
  iterations = 10
): Promise<BenchmarkResult> {
  const warmTimes: number[] = []

  // Cold start (first render)
  const coldResult = await renderSvgToPng(svg, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  })
  const coldStart = coldResult.renderTime

  // Warm renders
  for (let i = 0; i < iterations; i++) {
    const result = await renderSvgToPng(svg, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    })
    warmTimes.push(result.renderTime)
  }

  const warmAvg = warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length
  const warmMin = Math.min(...warmTimes)
  const warmMax = Math.max(...warmTimes)

  return {
    fixture: name,
    coldStart,
    warmAvg,
    warmMin,
    warmMax,
    iterations,
  }
}

async function runBenchmarks() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  SVG → PNG Renderer Benchmark (Sovereign Decks Production)')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Card dimensions: ${CARD_WIDTH}×${CARD_HEIGHT} @ 300 DPI`)
  console.log(`  Renderer: @resvg/resvg-js (Node.js path)`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  const results: BenchmarkResult[] = []

  for (const [name, svg] of Object.entries(fixtures)) {
    console.log(`Benchmarking ${name}.svg...`)
    const result = await benchmarkFixture(name, svg)
    results.push(result)

    console.log(`  Cold start:  ${result.coldStart.toFixed(2)}ms`)
    console.log(`  Warm avg:    ${result.warmAvg.toFixed(2)}ms (min: ${result.warmMin.toFixed(2)}, max: ${result.warmMax.toFixed(2)})`)
    console.log('')
  }

  // Batch benchmark
  console.log('Benchmarking batch (10 medium cards)...')
  const batchSvgs = Array(10).fill(fixtures.medium)
  const batchResult = await renderBatch(batchSvgs, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  })
  const batchAvg = batchResult.results.reduce((a, b) => a + b.renderTime, 0) / 10

  console.log(`  Total time:  ${batchResult.totalTime.toFixed(2)}ms`)
  console.log(`  Per-card avg: ${batchAvg.toFixed(2)}ms`)
  console.log('')

  // Summary table
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  PERFORMANCE BASELINES')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('| Scenario           | Current Avg | Target | Acceptable Max |')
  console.log('|--------------------|-------------|--------|----------------|')

  const simpleResult = results.find(r => r.fixture === 'simple')!
  const complexResult = results.find(r => r.fixture === 'complex')!
  const stressResult = results.find(r => r.fixture === 'stress')!

  console.log(`| Simple card        | ${simpleResult.warmAvg.toFixed(0).padStart(7)}ms  | ${(simpleResult.warmAvg * 0.8).toFixed(0).padStart(4)}ms | ${(simpleResult.warmMax * 1.2).toFixed(0).padStart(10)}ms |`)
  console.log(`| Complex card       | ${complexResult.warmAvg.toFixed(0).padStart(7)}ms  | ${(complexResult.warmAvg * 0.8).toFixed(0).padStart(4)}ms | ${(complexResult.warmMax * 1.2).toFixed(0).padStart(10)}ms |`)
  console.log(`| Stress test        | ${stressResult.warmAvg.toFixed(0).padStart(7)}ms  | ${(stressResult.warmAvg * 0.8).toFixed(0).padStart(4)}ms | ${(stressResult.warmMax * 1.2).toFixed(0).padStart(10)}ms |`)
  console.log(`| Batch (10 cards)   | ${batchResult.totalTime.toFixed(0).padStart(7)}ms  | ${(batchResult.totalTime * 0.8).toFixed(0).padStart(4)}ms | ${(batchResult.totalTime * 1.2).toFixed(0).padStart(10)}ms |`)
  console.log(`| Cold start         | ${simpleResult.coldStart.toFixed(0).padStart(7)}ms  | ${(simpleResult.coldStart * 0.8).toFixed(0).padStart(4)}ms | ${(simpleResult.coldStart * 1.5).toFixed(0).padStart(10)}ms |`)
  console.log('')
  console.log('Target = 20% improvement, Acceptable Max = 20% regression (50% for cold start)')
  console.log('')

  // Output PNG size info
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  OUTPUT SIZES')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  for (const [name, svg] of Object.entries(fixtures)) {
    const result = await renderSvgToPng(svg, { width: CARD_WIDTH, height: CARD_HEIGHT })
    const svgSize = Buffer.from(svg).length / 1024
    const pngSize = result.png.length / 1024
    console.log(`  ${name.padEnd(10)} SVG: ${svgSize.toFixed(1).padStart(5)} KB → PNG: ${pngSize.toFixed(0).padStart(5)} KB`)
  }
  console.log('')
}

runBenchmarks().catch(console.error)
