/**
 * API Request/Response Types
 */

import type { ModelId } from '../lib/ai-generator'
import type { ReactPerfMetrics, BundleStats } from '../lib/react-metrics'

// Competition
export interface CompeteRequest {
  challenge: string
  models?: ModelId[]
  maxAttempts?: number
  stream?: boolean
}

export interface CompeteResponse {
  jobId: string
  status: 'queued' | 'running' | 'completed' | 'failed'
}

// Validation
export interface ValidateRequest {
  challenge: string
  code: string
  runBenchmarks?: boolean
  runPerfTests?: boolean
}

export interface ValidateResponse {
  passed: boolean
  testResult: {
    passed: boolean
    errors: string[]
    duration: number
  }
  benchmarks?: Array<{
    name: string
    hz: number
    mean: number
    p75: number
    p99: number
  }>
  reactMetrics?: ReactPerfMetrics
}

// Generation
export interface GenerateRequest {
  model: ModelId
  challenge: string
  prompt?: string
  feedback?: string
}

export interface GenerateResponse {
  code: string
  model: ModelId
  duration: number
}

// Challenges
export interface CreateChallengeRequest {
  name: string
  type: 'function' | 'react-component'
  prompt: string
  testCode: string
  benchCode?: string
  perfConfig?: {
    componentProps?: Record<string, unknown>
    thresholds?: {
      minFps?: number
      maxAvgRenderTime?: number
      maxBundleSize?: number
    }
  }
  externalRepo?: {
    path: string
    testPath: string
    solutionPath?: string
  }
}

export interface ChallengeInfo {
  name: string
  type: 'function' | 'react-component'
  path: string
  hasResults: boolean
  isExternal?: boolean
}

export interface ChallengeDetailResponse extends ChallengeInfo {
  config: {
    type: string
    performanceThresholds?: Record<string, number>
  }
  prompt: string
  latestResults?: unknown
}

// SSE Events
export type SSEEventType = 'progress' | 'result' | 'complete' | 'error'

export interface ProgressEvent {
  model: string
  attempt: number
  phase: 'generating' | 'writing' | 'testing' | 'benchmarking' | 'analyzing'
  message: string
  timestamp: number
}

export interface ResultEvent {
  model: string
  passed: boolean
  attempts: number
  metrics?: {
    fps?: number
    avgRenderTime?: number
    bundleSize?: number
    benchmarks?: unknown[]
  }
}

export interface CompleteEvent {
  results: Array<{
    model: string
    passed: boolean
    attempts: number
    metrics?: unknown
  }>
  winner?: string
}

export interface ErrorEvent {
  error: string
  model?: string
  attempt?: number
}

// Health
export interface HealthResponse {
  status: 'ok'
  version: string
  uptime: number
  activeJobs: number
}
