/**
 * Jobs Route Handlers
 *
 * GET    /api/jobs           - List all jobs
 * GET    /api/jobs/:id       - Get job status (polling fallback)
 * GET    /api/jobs/:id/debug - Get detailed debug info for a job
 * DELETE /api/jobs/:id       - Cancel a job
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import { jobManager } from '../jobs/manager'
import { resolveChallengePath } from '../registry'
import { loadChallengeConfig } from '../../lib/challenge-config'

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
 * GET /api/jobs - List all jobs
 */
export function handleListJobs(): Response {
  const jobs = jobManager.getAllJobs()

  return json({
    jobs: jobs.map((job) => ({
      id: job.id,
      status: job.status,
      config: {
        challenge: job.config.challenge,
        models: job.config.models,
        maxAttempts: job.config.maxAttempts,
      },
      progress: {
        currentModel: job.progress.currentModel,
        currentAttempt: job.progress.currentAttempt,
        phase: job.progress.phase,
        completedModels: job.progress.completedModels,
        message: job.progress.message,
      },
      results: job.results,
      createdAt: job.createdAt,
    })),
  })
}

/**
 * GET /api/jobs/:id - Get job status
 */
export function handleJobStatus(jobId: string): Response {
  const job = jobManager.getJob(jobId)

  if (!job) {
    return json({ error: 'Job not found' }, 404)
  }

  return json({
    jobId: job.id,
    status: job.status,
    progress: {
      currentModel: job.progress.currentModel,
      currentAttempt: job.progress.currentAttempt,
      phase: job.progress.phase,
      completedModels: job.progress.completedModels,
      message: job.progress.message,
    },
    results: job.results,
    error: job.error,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  })
}

/**
 * DELETE /api/jobs/:id - Cancel a job
 */
export function handleCancelJob(jobId: string): Response {
  const job = jobManager.getJob(jobId)

  if (!job) {
    return json({ error: 'Job not found' }, 404)
  }

  const cancelled = jobManager.cancelJob(jobId)

  if (!cancelled) {
    return json({ error: 'Job cannot be cancelled (already completed or failed)' }, 400)
  }

  return json({
    cancelled: true,
    jobId,
  })
}

/**
 * Response type for debug endpoint
 */
interface JobDebugResponse {
  jobId: string
  challenge: string
  timestamp: string
  models: Record<
    string,
    {
      attempts: Array<{
        attemptNumber: number
        solution: string
        testOutput: {
          passed: boolean
          numTests: number
          numPassed: number
          numFailed: number
          failures: Array<{
            testName: string
            error: string
            expected?: string
            received?: string
          }>
          stdout?: string
        }
        prompt: string
        feedback?: string
        duration: number
      }>
      finalStatus: 'passed' | 'failed'
    }
  >
  promptMd: string
  config: unknown
}

/**
 * GET /api/jobs/:id/debug - Get detailed debug info for a job
 *
 * Returns full solutions, test outputs, prompts, and timing for each attempt.
 * Useful for debugging why tests failed and prompt engineering.
 *
 * Query params:
 *   model - Filter to a specific model (e.g., ?model=sonnet)
 */
export async function handleJobDebug(jobId: string, modelFilter?: string): Promise<Response> {
  const job = jobManager.getJob(jobId)

  if (!job) {
    return json({ error: 'Job not found' }, 404)
  }

  // Only allow debug on completed/failed jobs (not running or queued)
  if (job.status === 'queued' || job.status === 'running') {
    return json(
      {
        error: 'Job is still running',
        status: job.status,
        progress: job.progress,
      },
      400
    )
  }

  // Check if we have attempt history (required for debug info)
  if (!job.attemptHistory || Object.keys(job.attemptHistory).length === 0) {
    return json(
      {
        error: 'No debug information available for this job',
        hint: 'Debug info is only captured when job is run with debug=true or after recent server updates',
      },
      404
    )
  }

  // Load challenge prompt.md and config
  let promptMd = ''
  let challengeConfig: unknown = {}

  try {
    const challengePath = await resolveChallengePath(job.config.challenge)
    const promptPath = join(challengePath, 'prompt.md')
    promptMd = await readFile(promptPath, 'utf-8')
    challengeConfig = await loadChallengeConfig(challengePath)
  } catch {
    // Silently continue if challenge files can't be loaded
  }

  // Build models response with optional filtering
  const modelsToInclude = modelFilter
    ? Object.keys(job.attemptHistory).filter((m) => m === modelFilter)
    : Object.keys(job.attemptHistory)

  if (modelFilter && modelsToInclude.length === 0) {
    return json({ error: `Model '${modelFilter}' not found in job results` }, 404)
  }

  const modelsResponse: JobDebugResponse['models'] = {}

  for (const model of modelsToInclude) {
    const attempts = job.attemptHistory[model] || []
    const result = job.results.find((r) => r.model === model)

    modelsResponse[model] = {
      attempts: attempts.map((a) => ({
        attemptNumber: a.attemptNumber,
        solution: a.solution,
        testOutput: a.testOutput,
        prompt: a.prompt,
        feedback: a.feedback,
        duration: a.duration,
      })),
      finalStatus: result?.passed ? 'passed' : 'failed',
    }
  }

  const response: JobDebugResponse = {
    jobId: job.id,
    challenge: job.config.challenge,
    timestamp: new Date(job.createdAt).toISOString(),
    models: modelsResponse,
    promptMd,
    config: challengeConfig,
  }

  return json(response)
}
