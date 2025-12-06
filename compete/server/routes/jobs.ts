/**
 * Jobs Route Handlers
 *
 * GET    /api/jobs      - List all jobs
 * GET    /api/jobs/:id  - Get job status (polling fallback)
 * DELETE /api/jobs/:id  - Cancel a job
 */

import { jobManager } from '../jobs/manager'

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
