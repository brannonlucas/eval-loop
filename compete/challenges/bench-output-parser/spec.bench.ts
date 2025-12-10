import { describe, bench } from 'vitest'
import { parseBenchResults } from './solution'
import { generateBenchOutput } from './spec.test'

// Pre-generate test data
const smallAnsi = generateBenchOutput(10, true)
const smallClean = generateBenchOutput(10, false)
const mediumAnsi = generateBenchOutput(50, true)
const mediumClean = generateBenchOutput(50, false)
const largeAnsi = generateBenchOutput(200, true)
const largeClean = generateBenchOutput(200, false)
const hugeAnsi = generateBenchOutput(500, true)

describe('parseBenchResults - With ANSI codes', () => {
  bench('small output (10 benchmarks)', () => {
    parseBenchResults(smallAnsi)
  })

  bench('medium output (50 benchmarks)', () => {
    parseBenchResults(mediumAnsi)
  })

  bench('large output (200 benchmarks)', () => {
    parseBenchResults(largeAnsi)
  })

  bench('huge output (500 benchmarks)', () => {
    parseBenchResults(hugeAnsi)
  })
})

describe('parseBenchResults - Clean (no ANSI)', () => {
  bench('small output (10 benchmarks)', () => {
    parseBenchResults(smallClean)
  })

  bench('medium output (50 benchmarks)', () => {
    parseBenchResults(mediumClean)
  })

  bench('large output (200 benchmarks)', () => {
    parseBenchResults(largeClean)
  })
})

describe('parseBenchResults - Edge cases', () => {
  bench('empty string', () => {
    parseBenchResults('')
  })

  bench('single benchmark line', () => {
    parseBenchResults('   · single test    1,000.00  0.1000  0.2000  0.1500  0.1600  0.1800')
  })

  bench('ops/sec fallback format', () => {
    parseBenchResults('simple benchmark  5,000 ops/sec')
  })
})
