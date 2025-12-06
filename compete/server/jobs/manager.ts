/**
 * Job Queue Manager
 *
 * Manages competition jobs with queuing, state tracking, and cancellation.
 */

import type { Job, JobCreateOptions, JobStatus, JobProgress, JobResult } from './types'
import type { SSEStream } from '../sse/stream'

const MAX_CONCURRENT_JOBS = 2
const JOB_CLEANUP_AFTER_MS = 60 * 60 * 1000 // 1 hour

class JobManager {
  private jobs = new Map<string, Job>()
  private runningCount = 0
  private pendingQueue: string[] = []

  /**
   * Create a new job and add it to the queue
   */
  createJob(options: JobCreateOptions): Job {
    const job: Job = {
      id: crypto.randomUUID(),
      status: 'queued',
      config: options.config,
      progress: {
        completedModels: [],
      },
      results: [],
      createdAt: Date.now(),
      abortController: new AbortController(),
      sseStream: options.sseStream,
    }

    this.jobs.set(job.id, job)
    this.pendingQueue.push(job.id)

    // Schedule cleanup
    setTimeout(() => this.cleanupJob(job.id), JOB_CLEANUP_AFTER_MS)

    return job
  }

  /**
   * Get a job by ID
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id)
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): Job[] {
    return Array.from(this.jobs.values()).filter(
      (job) => job.status === 'queued' || job.status === 'running'
    )
  }

  /**
   * Get all jobs (for dashboard)
   */
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * Check if we can start more jobs and start them
   */
  tryStartNextJob(): Job | undefined {
    if (this.runningCount >= MAX_CONCURRENT_JOBS) return undefined
    if (this.pendingQueue.length === 0) return undefined

    const jobId = this.pendingQueue.shift()
    if (!jobId) return undefined

    const job = this.jobs.get(jobId)
    if (!job) return undefined

    this.runningCount++
    job.status = 'running'
    job.startedAt = Date.now()

    return job
  }

  /**
   * Update job progress
   */
  updateProgress(jobId: string, progress: Partial<JobProgress>) {
    const job = this.jobs.get(jobId)
    if (!job) return

    job.progress = { ...job.progress, ...progress }

    // Send SSE update if stream exists
    if (job.sseStream && !job.sseStream.isClosed()) {
      job.sseStream.send('progress', {
        model: job.progress.currentModel,
        attempt: job.progress.currentAttempt,
        phase: job.progress.phase,
        message: job.progress.message,
        timestamp: Date.now(),
      })
    }
  }

  /**
   * Add a result for a model
   */
  addResult(jobId: string, result: JobResult) {
    const job = this.jobs.get(jobId)
    if (!job) return

    job.results.push(result)
    job.progress.completedModels.push(result.model)

    // Send SSE update if stream exists
    if (job.sseStream && !job.sseStream.isClosed()) {
      job.sseStream.send('result', result)
    }
  }

  /**
   * Mark job as completed
   */
  completeJob(jobId: string) {
    const job = this.jobs.get(jobId)
    if (!job) return

    job.status = 'completed'
    job.completedAt = Date.now()
    this.runningCount--

    // Send SSE complete event
    if (job.sseStream && !job.sseStream.isClosed()) {
      const winner = job.results.find((r) => r.passed)?.model
      job.sseStream.send('complete', {
        results: job.results,
        winner,
      })
      job.sseStream.close()
    }

    // Try to start next queued job
    this.tryStartNextJob()
  }

  /**
   * Mark job as failed
   */
  failJob(jobId: string, error: string) {
    const job = this.jobs.get(jobId)
    if (!job) return

    job.status = 'failed'
    job.error = error
    job.completedAt = Date.now()
    this.runningCount--

    // Send SSE error event
    if (job.sseStream && !job.sseStream.isClosed()) {
      job.sseStream.send('error', { error })
      job.sseStream.close()
    }

    // Try to start next queued job
    this.tryStartNextJob()
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false

    if (job.status !== 'queued' && job.status !== 'running') {
      return false
    }

    job.abortController.abort()
    job.status = 'cancelled'
    job.completedAt = Date.now()

    if (job.status === 'running') {
      this.runningCount--
    } else {
      // Remove from pending queue
      this.pendingQueue = this.pendingQueue.filter((id) => id !== jobId)
    }

    if (job.sseStream && !job.sseStream.isClosed()) {
      job.sseStream.send('error', { error: 'Job cancelled' })
      job.sseStream.close()
    }

    // Try to start next queued job
    this.tryStartNextJob()

    return true
  }

  /**
   * Clean up old job data
   */
  private cleanupJob(jobId: string) {
    const job = this.jobs.get(jobId)
    if (!job) return

    // Only clean up completed/failed/cancelled jobs
    if (job.status === 'queued' || job.status === 'running') {
      // Reschedule cleanup
      setTimeout(() => this.cleanupJob(jobId), JOB_CLEANUP_AFTER_MS)
      return
    }

    this.jobs.delete(jobId)
  }

  /**
   * Get stats for health check
   */
  getStats() {
    return {
      totalJobs: this.jobs.size,
      runningJobs: this.runningCount,
      queuedJobs: this.pendingQueue.length,
    }
  }
}

// Singleton instance
export const jobManager = new JobManager()
