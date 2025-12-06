/**
 * Competition Route Handler
 *
 * POST /api/compete - Run a competition with SSE progress streaming
 */

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { CompeteRequest } from '../types'
import { createSSEStream, sseHeaders } from '../sse/stream'
import { jobManager } from '../jobs/manager'
import { generateSolution, type ModelId } from '../../lib/ai-generator'
import { runTests, runBenchmarks } from '../../lib/vitest-runner'
import { loadChallengeConfig, isReactChallenge } from '../../lib/challenge-config'
import { runPerfTest } from '../../lib/playwright-runner'
import { recordResult } from '../../lib/results'
import { resolveChallengePath } from '../registry'

const DEFAULT_MODELS: ModelId[] = ['sonnet', 'gpt4']
const DEFAULT_MAX_ATTEMPTS = 5

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

export function handleCompete(body: unknown): Response {
  const req = body as CompeteRequest

  if (!req.challenge) {
    return json({ error: 'challenge is required' }, 400)
  }

  const models = req.models || DEFAULT_MODELS
  const maxAttempts = req.maxAttempts || DEFAULT_MAX_ATTEMPTS
  const useSSE = req.stream !== false

  if (useSSE) {
    // SSE streaming response
    const sse = createSSEStream()

    const job = jobManager.createJob({
      config: { challenge: req.challenge, models, maxAttempts },
      sseStream: sse,
    })

    // Start job execution async
    runCompetitionJob(job.id).catch((err) => {
      jobManager.failJob(job.id, err.message)
    })

    // Try to start the job immediately if under limit
    jobManager.tryStartNextJob()

    return new Response(sse.stream, {
      headers: sseHeaders(),
    })
  } else {
    // Non-streaming: return job ID for polling
    const job = jobManager.createJob({
      config: { challenge: req.challenge, models, maxAttempts },
    })

    // Start job execution async
    runCompetitionJob(job.id).catch((err) => {
      jobManager.failJob(job.id, err.message)
    })

    // Try to start the job immediately if under limit
    jobManager.tryStartNextJob()

    return json({
      jobId: job.id,
      status: job.status,
    })
  }
}

/**
 * Run competition job (extracted from runner.ts)
 */
async function runCompetitionJob(jobId: string): Promise<void> {
  const job = jobManager.getJob(jobId)
  if (!job) return

  // Wait until job is started by manager
  while (job.status === 'queued') {
    await new Promise((r) => setTimeout(r, 100))
    if (job.abortController.signal.aborted) return
  }

  const { challenge, models, maxAttempts } = job.config

  try {
    const challengePath = await resolveChallengePath(challenge)
    const challengeConfig = await loadChallengeConfig(challengePath)
    const isReact = isReactChallenge(challengeConfig)

    for (const model of models) {
      if (job.abortController.signal.aborted) {
        throw new Error('Job cancelled')
      }

      jobManager.updateProgress(jobId, {
        currentModel: model,
        currentAttempt: 0,
        phase: 'generating',
        message: `Starting ${model}...`,
      })

      let attempts = 0
      let feedback = ''
      let lastCode = ''

      while (attempts < maxAttempts) {
        if (job.abortController.signal.aborted) {
          throw new Error('Job cancelled')
        }

        attempts++

        jobManager.updateProgress(jobId, {
          currentAttempt: attempts,
          phase: 'generating',
          message: `Generating solution (attempt ${attempts}/${maxAttempts})`,
        })

        try {
          // Generate solution
          const code = await generateSolution({ model, challenge, feedback })
          lastCode = code

          // Write solution file
          jobManager.updateProgress(jobId, {
            phase: 'writing',
            message: 'Writing solution file',
          })

          const fileExt = isReact ? 'tsx' : 'ts'
          const solutionPath = join(challengePath, 'solutions', `${model}.${fileExt}`)
          await mkdir(join(challengePath, 'solutions'), { recursive: true })
          await writeFile(solutionPath, code)

          const activeSolutionPath = join(challengePath, `solution.${fileExt}`)
          await writeFile(activeSolutionPath, code)

          // Run tests
          jobManager.updateProgress(jobId, {
            phase: 'testing',
            message: 'Running tests',
          })

          const testResult = await runTests(challenge)

          if (testResult.passed) {
            if (isReact) {
              jobManager.updateProgress(jobId, {
                phase: 'analyzing',
                message: 'Running performance tests',
              })

              const perfMetrics = await runPerfTest({
                componentPath: activeSolutionPath,
                thresholds: challengeConfig.performanceThresholds,
              })

              jobManager.addResult(jobId, {
                model,
                passed: perfMetrics.passed,
                attempts,
                metrics: {
                  fps: perfMetrics.fps.p95,
                  avgRenderTime: perfMetrics.renders.avgCommitTime,
                  bundleSize: perfMetrics.bundle.gzipped,
                },
              })
            } else {
              jobManager.updateProgress(jobId, {
                phase: 'benchmarking',
                message: 'Running benchmarks',
              })

              const benchResult = await runBenchmarks(challenge)

              jobManager.addResult(jobId, {
                model,
                passed: true,
                attempts,
                metrics: { benchmarks: benchResult },
              })
            }
            break
          } else {
            feedback = testResult.errors.join('\n')
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          feedback = `Error: ${message}`
        }
      }

      // If we exhausted attempts without passing
      if (attempts >= maxAttempts && !job.results.find((r) => r.model === model && r.passed)) {
        jobManager.addResult(jobId, {
          model,
          passed: false,
          attempts,
          error: feedback.slice(0, 500),
        })
      }
    }

    // Record results
    await recordResult(challenge, job.results as any, { maxAttempts, models }, challengeConfig.type)

    jobManager.completeJob(jobId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    jobManager.failJob(jobId, message)
  }
}
