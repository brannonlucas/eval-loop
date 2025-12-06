/**
 * Job Queue Types
 */

import type { ModelId } from '../../lib/ai-generator'
import type { SSEStream } from '../sse/stream'

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface JobConfig {
  challenge: string
  models: ModelId[]
  maxAttempts: number
}

export interface JobProgress {
  currentModel?: string
  currentAttempt?: number
  phase?: 'generating' | 'writing' | 'testing' | 'benchmarking' | 'analyzing'
  completedModels: string[]
  message?: string
}

export interface JobResult {
  model: string
  passed: boolean
  attempts: number
  metrics?: unknown
  error?: string
}

export interface Job {
  id: string
  status: JobStatus
  config: JobConfig
  progress: JobProgress
  results: JobResult[]
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  abortController: AbortController
  sseStream?: SSEStream
}

export interface JobCreateOptions {
  config: JobConfig
  sseStream?: SSEStream
}
