/**
 * Validation Route Handler
 *
 * POST /api/validate - Test user-provided code against a challenge's test suite
 */

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { ValidateRequest, ValidateResponse } from '../types'
import { runTests, runBenchmarks } from '../../lib/vitest-runner'
import { loadChallengeConfig, isReactChallenge } from '../../lib/challenge-config'
import { runPerfTest } from '../../lib/playwright-runner'
import { resolveChallengePath } from '../registry'

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

export async function handleValidate(body: unknown): Promise<Response> {
  const req = body as ValidateRequest

  if (!req.challenge) {
    return json({ error: 'challenge is required' }, 400)
  }

  if (!req.code) {
    return json({ error: 'code is required' }, 400)
  }

  try {
    const challengePath = await resolveChallengePath(req.challenge)
    const challengeConfig = await loadChallengeConfig(challengePath)
    const isReact = isReactChallenge(challengeConfig)

    // Write the code as the active solution
    const fileExt = isReact ? 'tsx' : 'ts'
    const activeSolutionPath = join(challengePath, `solution.${fileExt}`)

    await mkdir(challengePath, { recursive: true })
    await writeFile(activeSolutionPath, req.code)

    // Run tests
    const testResult = await runTests(req.challenge)

    const response: ValidateResponse = {
      passed: testResult.passed,
      testResult: {
        passed: testResult.passed,
        errors: testResult.errors,
        duration: testResult.duration,
      },
    }

    // Run benchmarks if requested and tests passed
    if (testResult.passed && req.runBenchmarks && !isReact) {
      const benchmarks = await runBenchmarks(req.challenge)
      response.benchmarks = benchmarks
    }

    // Run perf tests if requested and tests passed (React only)
    if (testResult.passed && req.runPerfTests && isReact) {
      const perfMetrics = await runPerfTest({
        componentPath: activeSolutionPath,
        thresholds: challengeConfig.performanceThresholds,
      })
      response.reactMetrics = perfMetrics
      response.passed = perfMetrics.passed
    }

    return json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: message }, 500)
  }
}
