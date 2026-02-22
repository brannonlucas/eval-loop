/**
 * Competition Route Handler
 *
 * POST /api/compete - Run a competition with SSE progress streaming.
 * Thin wrapper around the shared competition engine with job management.
 */

import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import type { CompeteRequest } from '../types'
import { createSSEStream, sseHeaders } from '../sse/stream'
import { jobManager } from '../jobs/manager'
import { loadChallengeConfig, isReactChallenge, type ChallengeConfig } from '../../lib/challenge-config'
import { resolveChallengePath } from '../registry'
import { runCompetition, type Phase } from '../../lib/competition'
import { parseVitestJsonString, type ParsedTestOutput } from '../../lib/vitest-parser'

const DEFAULT_MODELS = ['sonnet', 'gpt4']
const DEFAULT_MAX_ATTEMPTS = 5
const DEBUG_DIR = join(process.cwd(), 'compete/debug')

function formatModel(model: string): string {
  const names: Record<string, string> = {
    sonnet: 'Sonnet', opus: 'Opus', gpt4: 'GPT-4',
    haiku: 'Haiku', 'gpt4-turbo': 'GPT-4 Turbo',
  }
  return names[model] || model
}

function corsHeaders(): HeadersInit {
  return { 'Access-Control-Allow-Origin': '*' }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

function validateExternalRepoConfig(config: ChallengeConfig): string[] {
  const errors: string[] = []
  if (config.externalRepo) {
    if (!config.externalRepo.path) errors.push('externalRepo.path is required')
    if (!config.externalRepo.testPath) errors.push('externalRepo.testPath is required')
    if (!config.externalRepo.solutionPath) errors.push('externalRepo.solutionPath is required')
    if (config.externalRepo.path && !existsSync(config.externalRepo.path)) {
      errors.push(`External repo path not found: ${config.externalRepo.path}`)
    }
  }
  return errors
}

export async function handleCompete(body: unknown): Promise<Response> {
  const req = body as CompeteRequest

  if (!req.challenge) {
    return json({ error: 'challenge is required' }, 400)
  }

  // Pre-validate challenge config
  try {
    const challengePath = await resolveChallengePath(req.challenge)
    if (!existsSync(challengePath)) {
      return json({ error: `Challenge not found: ${req.challenge}` }, 404)
    }
    const challengeConfig = await loadChallengeConfig(challengePath)
    const validationErrors = validateExternalRepoConfig(challengeConfig)
    if (validationErrors.length > 0) {
      return json({ error: 'Invalid challenge configuration', details: validationErrors }, 400)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: `Failed to load challenge: ${message}` }, 400)
  }

  const models = req.models || DEFAULT_MODELS
  const maxAttempts = req.maxAttempts || DEFAULT_MAX_ATTEMPTS
  const useSSE = req.stream !== false
  const debug = req.debug ?? false
  const refinementRound = req.refinementRound ?? false

  if (useSSE) {
    const sse = createSSEStream()
    const job = jobManager.createJob({
      config: { challenge: req.challenge, models, maxAttempts, debug, refinementRound },
      sseStream: sse,
    })
    runCompetitionJob(job.id).catch(err => jobManager.failJob(job.id, err.message))
    jobManager.tryStartNextJob()
    return new Response(sse.stream, { headers: sseHeaders() })
  } else {
    const job = jobManager.createJob({
      config: { challenge: req.challenge, models, maxAttempts, debug, refinementRound },
    })
    runCompetitionJob(job.id).catch(err => jobManager.failJob(job.id, err.message))
    jobManager.tryStartNextJob()
    return json({ jobId: job.id, status: job.status })
  }
}

/**
 * Run competition job using the shared engine with jobManager hooks
 */
async function runCompetitionJob(jobId: string): Promise<void> {
  const job = jobManager.getJob(jobId)
  if (!job) return

  // Wait until job manager starts this job
  while (job.status === 'queued') {
    await new Promise(r => setTimeout(r, 100))
    if (job.abortController.signal.aborted) return
  }

  const { challenge, models, maxAttempts, debug, refinementRound } = job.config
  let debugPath: string | null = null

  try {
    const challengePath = await resolveChallengePath(challenge)
    const challengeConfig = await loadChallengeConfig(challengePath)
    const fileExt = isReactChallenge(challengeConfig) ? 'tsx' : 'ts'

    // Create debug directory if needed
    if (debug) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      debugPath = join(DEBUG_DIR, `${timestamp}-${challenge}`)
      await mkdir(debugPath, { recursive: true })
      jobManager.setDebugPath(jobId, debugPath)
    }

    await runCompetition(
      {
        challenge,
        challengePath,
        models,
        maxAttempts,
        refinementRound,
        keepWorkspace: debug,
        captureTestOutput: debug,
      },
      {
        onProgress: (model, attempt, phase, message) => {
          // Map generic messages to human-readable SSE events
          const displayMsg = buildProgressMessage(model, attempt, phase, message)
          jobManager.updateProgress(jobId, {
            currentModel: model || undefined,
            currentAttempt: attempt || undefined,
            phase: phase as any,
            message: displayMsg,
          })
        },

        onModelResult: (result) => {
          const jobResult: { model: string; passed: boolean; attempts: number; metrics?: unknown; error?: string } = {
            model: result.model,
            passed: result.passed,
            attempts: result.attempts,
            error: result.error,
          }

          // Transform metrics for job format
          if (result.reactMetrics) {
            jobResult.metrics = {
              fps: result.reactMetrics.fps.p95,
              avgRenderTime: result.reactMetrics.renders.avgCommitTime,
              bundleSize: result.reactMetrics.bundle.gzipped,
            }
          } else if (result.benchmarks) {
            jobResult.metrics = { benchmarks: result.benchmarks }
          }

          jobManager.addResult(jobId, jobResult)

          // Save result to debug directory
          if (debugPath) {
            const modelDebugPath = join(debugPath, result.model)
            mkdir(modelDebugPath, { recursive: true }).then(() =>
              writeFile(join(modelDebugPath, 'result.json'), JSON.stringify(jobResult, null, 2))
            )
          }
        },

        onAttempt: (model, info) => {
          // Parse test output for debug tracking
          let testOutput: ParsedTestOutput
          if (info.rawTestOutput) {
            testOutput = parseVitestJsonString(info.rawTestOutput)
          } else {
            testOutput = {
              passed: info.testPassed,
              numTests: info.testPassed ? 1 : 0,
              numPassed: info.testPassed ? 1 : 0,
              numFailed: info.testPassed ? 0 : info.testErrors.length,
              failures: info.testErrors.map(err => ({ testName: 'unknown', error: err })),
            }
          }

          jobManager.addAttemptRecord(jobId, model, {
            attemptNumber: info.attempt,
            solution: info.code,
            prompt: `Challenge: ${challenge}${info.feedback ? `\nFeedback from previous attempt:\n${info.feedback}` : ''}`,
            feedback: info.feedback || undefined,
            duration: info.duration,
            testOutput,
          })

          // Save debug artifacts
          if (debugPath) {
            const modelDebugPath = join(debugPath, model)
            mkdir(modelDebugPath, { recursive: true }).then(async () => {
              await writeFile(join(modelDebugPath, `solution.${fileExt}`), info.code)
              if (info.rawTestOutput) {
                await writeFile(join(modelDebugPath, 'vitest-output.txt'), info.rawTestOutput)
              }
            })
          }
        },

        shouldAbort: () => job.abortController.signal.aborted,
      }
    )

    jobManager.completeJob(jobId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    jobManager.failJob(jobId, message)
  }
}

/**
 * Build human-readable progress messages for SSE events
 */
function buildProgressMessage(model: string, attempt: number, phase: Phase, _fallback: string): string {
  const name = model ? formatModel(model) : ''

  switch (phase) {
    case 'setup':
      return `Preparing workspace...`
    case 'generating':
      return attempt === 1
        ? `${name} is crafting a solution...`
        : `Attempt ${attempt}: ${name} adjusts strategy...`
    case 'writing':
      return `${name} commits the solution...`
    case 'testing':
      return `Testing ${name}'s implementation...`
    case 'benchmarking':
      return `Benchmarking ${name}'s algorithm...`
    case 'analyzing':
      return `Measuring ${name}'s render performance...`
    case 'refinement':
      return _fallback // Refinement messages are already descriptive
    default:
      return _fallback
  }
}
