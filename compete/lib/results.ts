import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import type { BenchResult } from './vitest-runner'
import type { ReactPerfMetrics } from './react-metrics'
import { calculatePerfScore, formatMetrics } from './react-metrics'

export interface ModelResult {
  model: string
  attempts: number
  passed: boolean
  benchmarks?: BenchResult[]
  reactMetrics?: ReactPerfMetrics
  codeSize?: number
  tokensUsed?: number
  duration?: number
  error?: string
  /** Was this result from the refinement round? */
  isRefinement?: boolean
  /** Which model's solution was used as the reference (for refinement round) */
  refinedFrom?: string
}

export interface CompetitionResult {
  challenge: string
  timestamp: string
  type: 'function' | 'react-component'
  config: {
    maxAttempts: number
    models: string[]
  }
  results: ModelResult[]
  /** Was refinement round enabled? */
  refinementEnabled?: boolean
  /** Results from refinement round (separate from initial) */
  refinementResults?: ModelResult[]
  /** Which model's solution was used as reference for refinement */
  refinementWinner?: string
}

const RESULTS_DIR = join(process.cwd(), 'compete/results')

export interface RecordResultOptions {
  challenge: string
  results: ModelResult[]
  config: { maxAttempts: number; models: string[] }
  type?: 'function' | 'react-component'
  refinementEnabled?: boolean
  refinementResults?: ModelResult[]
  refinementWinner?: string
}

export async function recordResult(
  optionsOrChallenge: RecordResultOptions | string,
  results?: ModelResult[],
  config?: { maxAttempts: number; models: string[] },
  type: 'function' | 'react-component' = 'function'
): Promise<void> {
  // Support both old signature and new options object
  const opts: RecordResultOptions =
    typeof optionsOrChallenge === 'string'
      ? { challenge: optionsOrChallenge, results: results!, config: config!, type }
      : optionsOrChallenge

  const result: CompetitionResult = {
    challenge: opts.challenge,
    timestamp: new Date().toISOString(),
    type: opts.type ?? 'function',
    config: opts.config,
    results: opts.results,
    refinementEnabled: opts.refinementEnabled,
    refinementResults: opts.refinementResults,
    refinementWinner: opts.refinementWinner,
  }

  const filePath = join(RESULTS_DIR, `${opts.challenge}.json`)

  // Ensure directory exists
  await mkdir(dirname(filePath), { recursive: true })

  // Load existing results if any
  let history: CompetitionResult[] = []
  try {
    const existing = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(existing)
    history = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    // File doesn't exist yet
  }

  // Append new result
  history.push(result)

  // Keep last 100 runs
  if (history.length > 100) {
    history = history.slice(-100)
  }

  await writeFile(filePath, JSON.stringify(history, null, 2))
}

/**
 * Compare two ModelResults and return the better one.
 * Uses challenge type to determine comparison metrics.
 */
export function getBestResult(
  initial: ModelResult | undefined,
  refined: ModelResult | undefined,
  challengeType: 'function' | 'react-component'
): ModelResult & { source: 'initial' | 'refined' } {
  // If only one exists, return it
  if (!initial && !refined) throw new Error('At least one result required')
  if (!initial) return { ...refined!, source: 'refined' }
  if (!refined) return { ...initial, source: 'initial' }

  // If one passed and one failed, prefer the passing one
  if (initial.passed && !refined.passed) return { ...initial, source: 'initial' }
  if (!initial.passed && refined.passed) return { ...refined!, source: 'refined' }

  // Both passed or both failed - compare by performance
  if (challengeType === 'function') {
    const initialHz = initial.benchmarks?.[0]?.hz ?? 0
    const refinedHz = refined.benchmarks?.[0]?.hz ?? 0
    return refinedHz > initialHz
      ? { ...refined!, source: 'refined' }
      : { ...initial, source: 'initial' }
  }

  // React component - compare by performance score
  const initialScore = initial.reactMetrics ? calculatePerfScore(initial.reactMetrics) : 0
  const refinedScore = refined.reactMetrics ? calculatePerfScore(refined.reactMetrics) : 0
  return refinedScore > initialScore
    ? { ...refined!, source: 'refined' }
    : { ...initial, source: 'initial' }
}

/**
 * Get the best results for each model from initial and refinement rounds
 */
export function getBestResultsPerModel(
  initialResults: ModelResult[],
  refinementResults: ModelResult[] | undefined,
  challengeType: 'function' | 'react-component'
): Array<ModelResult & { source: 'initial' | 'refined' }> {
  const models = new Set([
    ...initialResults.map((r) => r.model),
    ...(refinementResults?.map((r) => r.model) ?? []),
  ])

  return Array.from(models).map((model) => {
    const initial = initialResults.find((r) => r.model === model)
    const refined = refinementResults?.find((r) => r.model === model)
    return getBestResult(initial, refined, challengeType)
  })
}

export async function getLeaderboard(challenge: string): Promise<void> {
  const filePath = join(RESULTS_DIR, `${challenge}.json`)

  try {
    const content = await readFile(filePath, 'utf-8')
    const history: CompetitionResult[] = JSON.parse(content)

    if (history.length === 0) {
      console.log(`No results found for challenge: ${challenge}`)
      return
    }

    const latest = history[history.length - 1]
    console.log(`\n=== Leaderboard: ${challenge} ===`)
    console.log(`Type: ${latest.type}`)
    console.log(`Last run: ${latest.timestamp}\n`)

    if (latest.type === 'react-component') {
      printReactLeaderboard(latest.results)
    } else {
      printFunctionLeaderboard(latest.results)
    }
  } catch {
    console.log(`No results found for challenge: ${challenge}`)
  }
}

function printFunctionLeaderboard(results: ModelResult[]): void {
  // Sort by: passed first, then by benchmark performance
  const sorted = [...results].sort((a, b) => {
    // Failed attempts go last
    if (a.passed !== b.passed) return a.passed ? -1 : 1
    // Sort by attempts (fewer is better)
    if (a.attempts !== b.attempts) return a.attempts - b.attempts
    // Sort by benchmark performance if available
    const aHz = a.benchmarks?.[0]?.hz ?? 0
    const bHz = b.benchmarks?.[0]?.hz ?? 0
    return bHz - aHz // Higher is better
  })

  console.log('Rank | Model   | Attempts | Status | Benchmark')
  console.log('-----|---------|----------|--------|----------')

  sorted.forEach((r, i) => {
    const rank = i + 1
    const status = r.passed ? 'PASS' : 'FAIL'
    const bench = r.benchmarks?.[0]?.hz
      ? `${r.benchmarks[0].hz.toFixed(0)} ops/sec`
      : '-'
    console.log(
      `${rank.toString().padStart(4)} | ${r.model.padEnd(7)} | ${r.attempts.toString().padStart(8)} | ${status.padEnd(6)} | ${bench}`
    )
  })

  console.log('')
}

function printReactLeaderboard(results: ModelResult[]): void {
  // Sort by: passed first, then by performance score
  const sorted = [...results].sort((a, b) => {
    // Failed attempts go last
    if (a.passed !== b.passed) return a.passed ? -1 : 1
    // Sort by attempts (fewer is better)
    if (a.attempts !== b.attempts) return a.attempts - b.attempts
    // Sort by perf score
    const aScore = a.reactMetrics ? calculatePerfScore(a.reactMetrics) : 0
    const bScore = b.reactMetrics ? calculatePerfScore(b.reactMetrics) : 0
    return bScore - aScore // Higher is better
  })

  console.log('Rank | Model   | Attempts | Score | FPS(p95) | Renders | Bundle')
  console.log('-----|---------|----------|-------|----------|---------|-------')

  sorted.forEach((r, i) => {
    const rank = i + 1
    const score = r.reactMetrics ? calculatePerfScore(r.reactMetrics).toString() : '-'
    const fps = r.reactMetrics ? r.reactMetrics.fps.p95.toFixed(1) : '-'
    const renders = r.reactMetrics ? r.reactMetrics.renders.renderCount.toString() : '-'
    const bundle = r.reactMetrics
      ? `${(r.reactMetrics.bundle.gzipped / 1024).toFixed(1)}KB`
      : '-'

    console.log(
      `${rank.toString().padStart(4)} | ${r.model.padEnd(7)} | ${r.attempts.toString().padStart(8)} | ${score.padStart(5)} | ${fps.padStart(8)} | ${renders.padStart(7)} | ${bundle}`
    )
  })

  console.log('')
}

export function printResults(results: ModelResult[]): void {
  console.log('\n=== Competition Results ===\n')

  for (const r of results) {
    console.log(`Model: ${r.model}`)
    console.log(`  Status: ${r.passed ? 'PASSED' : 'FAILED'}`)
    console.log(`  Attempts: ${r.attempts}`)

    if (r.benchmarks && r.benchmarks.length > 0) {
      console.log('  Benchmarks:')
      for (const b of r.benchmarks) {
        console.log(`    - ${b.name}: ${b.hz.toFixed(2)} ops/sec`)
      }
    }

    if (r.reactMetrics) {
      console.log('  React Performance:')
      const lines = formatMetrics(r.reactMetrics).split('\n')
      for (const line of lines) {
        console.log(`  ${line}`)
      }
    }

    if (r.error) {
      console.log(`  Error: ${r.error}`)
    }

    console.log('')
  }
}
