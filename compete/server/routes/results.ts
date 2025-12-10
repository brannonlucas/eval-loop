/**
 * Results Route Handler
 *
 * GET /api/results - Get all historical competition results
 */

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

const RESULTS_DIR = join(process.cwd(), 'compete/results')

interface ModelResult {
  model: string
  passed: boolean
  attempts: number
  benchmarks?: any[]
  reactMetrics?: any
  metrics?: any
  codeSize?: number
  duration?: number
  error?: string
}

interface CompetitionResult {
  challenge: string
  timestamp: string
  type?: 'function' | 'react-component'
  config: {
    maxAttempts: number
    models: string[]
  }
  results: ModelResult[]
}

interface ResultEntry {
  id: string
  challenge: string
  timestamp: string
  type: string
  config: {
    maxAttempts: number
    models: string[]
  }
  modelResults: Array<{
    model: string
    passed: boolean
    attempts: number
    metrics: any
    error?: string
  }>
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  })
}

/**
 * GET /api/results - Get all historical competition results
 * Query params:
 *   - challenge: Filter by challenge name
 *   - model: Filter by model
 *   - limit: Max number of results (default: 500)
 */
export async function handleResults(url: URL): Promise<Response> {
  try {
    const challengeFilter = url.searchParams.get('challenge')
    const modelFilter = url.searchParams.get('model')
    const limit = parseInt(url.searchParams.get('limit') || '500', 10)

    const allResults: ResultEntry[] = []

    // Read all JSON files from results directory
    let files: string[] = []
    try {
      const entries = await readdir(RESULTS_DIR)
      files = entries.filter(f => f.endsWith('.json'))
    } catch {
      // No results directory yet
      return json({ results: [] })
    }

    for (const file of files) {
      const challengeName = file.replace('.json', '')

      // Skip if filtering by challenge and this doesn't match
      if (challengeFilter && challengeName !== challengeFilter) {
        continue
      }

      try {
        const content = await readFile(join(RESULTS_DIR, file), 'utf-8')
        const history: CompetitionResult[] = JSON.parse(content)

        // Handle both array and single-object formats
        const resultArray = Array.isArray(history) ? history : [history]

        for (const result of resultArray) {
          // Create normalized model results
          const modelResults = (result.results || []).map(r => ({
            model: r.model,
            passed: r.passed,
            attempts: r.attempts,
            metrics: r.metrics || r.reactMetrics || r.benchmarks || null,
            error: r.error,
          }))

          // Skip if filtering by model and no matching model in this run
          if (modelFilter && !modelResults.some(m => m.model === modelFilter)) {
            continue
          }

          // Filter model results if model filter is active
          const filteredModelResults = modelFilter
            ? modelResults.filter(m => m.model === modelFilter)
            : modelResults

          allResults.push({
            id: `${challengeName}-${result.timestamp}`,
            challenge: challengeName,
            timestamp: result.timestamp,
            type: result.type || 'function',
            config: result.config,
            modelResults: filteredModelResults,
          })
        }
      } catch {
        // Skip invalid files
      }
    }

    // Sort by timestamp (newest first)
    allResults.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Apply limit
    const limitedResults = allResults.slice(0, limit)

    return json({
      results: limitedResults,
      total: allResults.length,
      limit,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: message }, 500)
  }
}
