/**
 * Competition Route Handler
 *
 * POST /api/compete - Run a competition with SSE progress streaming
 */

import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import type { CompeteRequest } from '../types'
import { createSSEStream, sseHeaders } from '../sse/stream'
import { jobManager } from '../jobs/manager'
import { generateSolution, type ModelId } from '../../lib/ai-generator'
import { runTests, runBenchmarks, type TestRunOptions } from '../../lib/vitest-runner'
import { loadChallengeConfig, isReactChallenge, type ChallengeConfig } from '../../lib/challenge-config'
import { runPerfTest } from '../../lib/playwright-runner'
import { recordResult } from '../../lib/results'
import { resolveChallengePath } from '../registry'
import {
  setupExternalWorkspace,
  isExternalRepoChallenge,
  type WorkspaceContext,
} from '../../lib/workspace'

const DEFAULT_MODELS: ModelId[] = ['sonnet', 'gpt4']
const DEFAULT_MAX_ATTEMPTS = 5
const DEBUG_DIR = join(process.cwd(), 'compete/debug')

/**
 * Create debug artifacts directory path for a job
 */
function createDebugPath(challenge: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return join(DEBUG_DIR, `${timestamp}-${challenge}`)
}

/**
 * Format model ID as display name
 */
function formatModel(model: string): string {
  const names: Record<string, string> = {
    sonnet: 'Sonnet',
    opus: 'Opus',
    gpt4: 'GPT-4',
    haiku: 'Haiku',
    'gpt4-turbo': 'GPT-4 Turbo',
  }
  return names[model] || model
}

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
 * Validate external repo configuration before starting job
 */
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

  // Validate challenge config before creating job
  try {
    const challengePath = await resolveChallengePath(req.challenge)
    // Check challenge directory exists
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

  if (useSSE) {
    // SSE streaming response
    const sse = createSSEStream()

    const job = jobManager.createJob({
      config: { challenge: req.challenge, models, maxAttempts, debug },
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
      config: { challenge: req.challenge, models, maxAttempts, debug },
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

  const { challenge, models, maxAttempts, debug } = job.config
  let workspace: WorkspaceContext | null = null
  let debugPath: string | null = null

  try {
    const challengePath = await resolveChallengePath(challenge)
    const challengeConfig = await loadChallengeConfig(challengePath)
    const isReact = isReactChallenge(challengeConfig)
    const isExternal = isExternalRepoChallenge(challengeConfig)
    const fileExt = isReact ? 'tsx' : 'ts'

    // Create debug directory if debug mode enabled
    if (debug) {
      debugPath = createDebugPath(challenge)
      await mkdir(debugPath, { recursive: true })
    }

    // Set up workspace for external repo challenges
    if (isExternal && challengeConfig.externalRepo) {
      jobManager.updateProgress(jobId, {
        currentModel: '',
        currentAttempt: 0,
        phase: 'setup',
        message: `Preparing isolated workspace for ${challenge}...`,
      })

      workspace = await setupExternalWorkspace({
        challengeName: challenge,
        challengePath,
        externalRepo: challengeConfig.externalRepo,
        fileExt,
        keepWorkspace: debug, // Keep workspace for inspection in debug mode
      })
    }

    for (const model of models) {
      if (job.abortController.signal.aborted) {
        throw new Error('Job cancelled')
      }

      jobManager.updateProgress(jobId, {
        currentModel: model,
        currentAttempt: 0,
        phase: 'generating',
        message: `${formatModel(model)} is analyzing the ${challenge} challenge...`,
      })

      let attempts = 0
      let feedback = ''
      let lastCode = ''
      let modelDebugPath: string | null = null

      while (attempts < maxAttempts) {
        if (job.abortController.signal.aborted) {
          throw new Error('Job cancelled')
        }

        attempts++

        const generatingMsg =
          attempts === 1
            ? `${formatModel(model)} is crafting a solution...`
            : `Attempt ${attempts}: ${formatModel(model)} adjusts strategy...`
        jobManager.updateProgress(jobId, {
          currentAttempt: attempts,
          phase: 'generating',
          message: generatingMsg,
        })

        try {
          // Generate solution
          const code = await generateSolution({ model, challenge, feedback })
          lastCode = code

          // Write solution file
          jobManager.updateProgress(jobId, {
            phase: 'writing',
            message: `${formatModel(model)} commits the solution...`,
          })

          let activeSolutionPath: string

          // Create model-specific debug directory
          if (debugPath) {
            modelDebugPath = join(debugPath, model)
            await mkdir(modelDebugPath, { recursive: true })
            // Save solution to debug directory
            await writeFile(join(modelDebugPath, `solution.${fileExt}`), code)
          }

          if (workspace) {
            // External repo: write to isolated workspace
            await mkdir(join(workspace.workspacePath, 'solutions'), { recursive: true })
            const modelSolutionPath = join(workspace.workspacePath, 'solutions', `${model}.${fileExt}`)
            await writeFile(modelSolutionPath, code)

            // Write as the active solution for test import
            await writeFile(workspace.solutionPath, code)
            activeSolutionPath = workspace.solutionPath
          } else {
            // Standard challenge: write to challenge directory
            const solutionPath = join(challengePath, 'solutions', `${model}.${fileExt}`)
            await mkdir(join(challengePath, 'solutions'), { recursive: true })
            await writeFile(solutionPath, code)

            activeSolutionPath = join(challengePath, `solution.${fileExt}`)
            await writeFile(activeSolutionPath, code)
          }

          // Run tests
          jobManager.updateProgress(jobId, {
            phase: 'testing',
            message: `Testing ${formatModel(model)}'s implementation...`,
          })

          const testRunOptions: TestRunOptions = workspace
            ? {
                workspacePath: workspace.workspacePath,
                testFilePath: workspace.testPath,
                captureFullOutput: debug,
              }
            : { captureFullOutput: debug }
          const testResult = await runTests(challenge, testRunOptions)

          // Save test output to debug directory
          if (modelDebugPath && testResult.rawOutput) {
            await writeFile(join(modelDebugPath, 'vitest-output.txt'), testResult.rawOutput)
          }

          if (testResult.passed) {
            if (isReact) {
              jobManager.updateProgress(jobId, {
                phase: 'analyzing',
                message: `Measuring ${formatModel(model)}'s render performance...`,
              })

              const perfMetrics = await runPerfTest({
                componentPath: activeSolutionPath,
                thresholds: challengeConfig.performanceThresholds,
              })

              const reactResult = {
                model,
                passed: perfMetrics.passed,
                attempts,
                metrics: {
                  fps: perfMetrics.fps.p95,
                  avgRenderTime: perfMetrics.renders.avgCommitTime,
                  bundleSize: perfMetrics.bundle.gzipped,
                },
              }
              jobManager.addResult(jobId, reactResult)

              // Save result to debug directory
              if (modelDebugPath) {
                await writeFile(join(modelDebugPath, 'result.json'), JSON.stringify(reactResult, null, 2))
              }
            } else {
              jobManager.updateProgress(jobId, {
                phase: 'benchmarking',
                message: `Benchmarking ${formatModel(model)}'s algorithm...`,
              })

              const benchResult = await runBenchmarks(challenge)

              const functionResult = {
                model,
                passed: true,
                attempts,
                metrics: { benchmarks: benchResult },
              }
              jobManager.addResult(jobId, functionResult)

              // Save result to debug directory
              if (modelDebugPath) {
                await writeFile(join(modelDebugPath, 'result.json'), JSON.stringify(functionResult, null, 2))
              }
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
        const failedResult = {
          model,
          passed: false,
          attempts,
          error: feedback.slice(0, 500),
        }
        jobManager.addResult(jobId, failedResult)

        // Save result to debug directory
        if (modelDebugPath) {
          await writeFile(join(modelDebugPath, 'result.json'), JSON.stringify(failedResult, null, 2))
        }
      }
    }

    // Record results
    await recordResult(challenge, job.results as any, { maxAttempts, models }, challengeConfig.type)

    jobManager.completeJob(jobId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    jobManager.failJob(jobId, message)
  } finally {
    // Clean up workspace
    if (workspace) {
      await workspace.cleanup()
    }
  }
}
