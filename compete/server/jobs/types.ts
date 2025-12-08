/**
 * Job Queue Types
 */

import type { ModelId } from '../../lib/ai-generator'
import type { SSEStream } from '../sse/stream'
import type { ParsedTestOutput } from '../../lib/vitest-parser'

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * Per-attempt tracking for debug endpoint
 */
export interface AttemptRecord {
  attemptNumber: number
  solution: string
  prompt: string
  feedback?: string // Error feedback from previous attempt
  duration: number // Generation time in ms
  testOutput: ParsedTestOutput
}

export interface JobConfig {
  challenge: string
  models: ModelId[]
  maxAttempts: number
  debug?: boolean
  refinementRound?: boolean
}

export interface JobProgress {
  currentModel?: string
  currentAttempt?: number
  phase?: 'setup' | 'generating' | 'writing' | 'testing' | 'benchmarking' | 'analyzing' | 'refinement'
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
  // Debug tracking
  debugPath?: string
  attemptHistory?: Record<string, AttemptRecord[]>
}

export interface JobCreateOptions {
  config: JobConfig
  sseStream?: SSEStream
}
