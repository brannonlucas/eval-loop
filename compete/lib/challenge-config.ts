/**
 * Challenge Configuration
 *
 * Handles challenge type detection and config loading for both
 * function-based and React component challenges.
 */

import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'

export type ChallengeType = 'function' | 'react-component'

export interface PerformanceThresholds {
  /** Minimum acceptable FPS (p95) during interaction */
  minFps?: number
  /** Maximum acceptable render count during test scenario */
  maxRenderCount?: number
  /** Maximum bundle size in bytes (gzipped) */
  maxBundleSize?: number
  /** Maximum memory growth in bytes */
  maxMemoryGrowth?: number
}

export interface ExternalRepoConfig {
  /** Path to the external repository root */
  path: string
  /** Path to the test file relative to the external repo */
  testPath: string
  /** Path where the AI solution should be written, relative to external repo */
  solutionPath: string
}

export interface ChallengeConfig {
  /** Challenge type determines which runner to use */
  type: ChallengeType
  /** Display name for results */
  name?: string
  /** Performance thresholds for scoring */
  performanceThresholds?: PerformanceThresholds
  /** Time limit for AI generation in ms */
  generationTimeout?: number
  /** Maximum retry attempts for failed tests */
  maxRetries?: number
  /** External repository configuration for isolated testing */
  externalRepo?: ExternalRepoConfig
}

const DEFAULT_FUNCTION_CONFIG: ChallengeConfig = {
  type: 'function',
  generationTimeout: 60000,
  maxRetries: 3,
}

const DEFAULT_REACT_CONFIG: ChallengeConfig = {
  type: 'react-component',
  generationTimeout: 90000,
  maxRetries: 3,
  performanceThresholds: {
    minFps: 55,
    maxRenderCount: 100,
    maxBundleSize: 5 * 1024, // 5KB gzipped
  },
}

/**
 * Load challenge configuration from challenge.config.json
 * Falls back to type detection if no config file exists
 */
export async function loadChallengeConfig(challengePath: string): Promise<ChallengeConfig> {
  const configPath = join(challengePath, 'challenge.config.json')

  if (existsSync(configPath)) {
    const raw = await readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<ChallengeConfig>

    // Merge with defaults based on type
    const defaults = parsed.type === 'react-component'
      ? DEFAULT_REACT_CONFIG
      : DEFAULT_FUNCTION_CONFIG

    return { ...defaults, ...parsed }
  }

  // Auto-detect type from file extensions
  const detectedType = await detectChallengeType(challengePath)
  return detectedType === 'react-component'
    ? DEFAULT_REACT_CONFIG
    : DEFAULT_FUNCTION_CONFIG
}

/**
 * Detect challenge type by looking for .tsx files
 */
async function detectChallengeType(challengePath: string): Promise<ChallengeType> {
  // Check for tsx solution file
  const tsxSolution = join(challengePath, 'solution.tsx')
  if (existsSync(tsxSolution)) {
    return 'react-component'
  }

  // Check for tsx test file
  const tsxTest = join(challengePath, 'spec.test.tsx')
  if (existsSync(tsxTest)) {
    return 'react-component'
  }

  return 'function'
}

/**
 * Check if a challenge is a React component challenge
 */
export function isReactChallenge(config: ChallengeConfig): boolean {
  return config.type === 'react-component'
}
