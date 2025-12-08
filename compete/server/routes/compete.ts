/**
 * Competition Route Handler
 *
 * POST /api/compete - Run a competition with SSE progress streaming
 */

import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import type { CompeteRequest } from '../types'
import { createSSEStream, sseHeaders } from '../sse/stream'
import { jobManager } from '../jobs/manager'
import { generateSolution, type ModelId } from '../../lib/ai-generator'
import { runTests, runBenchmarks, type TestRunOptions } from '../../lib/vitest-runner'
import { loadChallengeConfig, isReactChallenge, type ChallengeConfig } from '../../lib/challenge-config'
import { runPerfTest } from '../../lib/playwright-runner'
import { recordResult, type ModelResult } from '../../lib/results'
import { calculatePerfScore } from '../../lib/react-metrics'
import { resolveChallengePath } from '../registry'
import {
  setupExternalWorkspace,
  isExternalRepoChallenge,
  type WorkspaceContext,
} from '../../lib/workspace'
import {
  buildRefinementPrompt,
  calculateImprovement,
  type WinnerMetrics,
} from '../../lib/refinement-prompt'
import { parseVitestJsonString, type ParsedTestOutput } from '../../lib/vitest-parser'

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
  const refinementRound = req.refinementRound ?? false

  if (useSSE) {
    // SSE streaming response
    const sse = createSSEStream()

    const job = jobManager.createJob({
      config: { challenge: req.challenge, models, maxAttempts, debug, refinementRound },
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
      config: { challenge: req.challenge, models, maxAttempts, debug, refinementRound },
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

  const { challenge, models, maxAttempts, debug, refinementRound } = job.config
  let workspace: WorkspaceContext | null = null
  let debugPath: string | null = null
  const refinementResults: ModelResult[] = []
  let refinementWinner: string | undefined

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
      jobManager.setDebugPath(jobId, debugPath)
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

        // Track timing for attempt
        const attemptStartTime = Date.now()
        const attemptFeedback = feedback // Capture feedback used for this attempt
        let attemptDuration = 0
        let attemptTestOutput: ParsedTestOutput | null = null

        try {
          // Generate solution
          const code = await generateSolution({ model, challenge, feedback })
          attemptDuration = Date.now() - attemptStartTime
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

          // Parse test output for debug tracking
          if (testResult.rawOutput) {
            // Try to parse as JSON first (vitest --reporter json)
            attemptTestOutput = parseVitestJsonString(testResult.rawOutput)
          } else {
            // Fallback: construct from errors array
            attemptTestOutput = {
              passed: testResult.passed,
              numTests: testResult.passed ? 1 : 0,
              numPassed: testResult.passed ? 1 : 0,
              numFailed: testResult.passed ? 0 : testResult.errors.length,
              failures: testResult.errors.map((err) => ({
                testName: 'unknown',
                error: err,
              })),
            }
          }

          // Record attempt for debug endpoint
          jobManager.addAttemptRecord(jobId, model, {
            attemptNumber: attempts,
            solution: code,
            prompt: `Challenge: ${challenge}${attemptFeedback ? `\nFeedback from previous attempt:\n${attemptFeedback}` : ''}`,
            feedback: attemptFeedback || undefined,
            duration: attemptDuration,
            testOutput: attemptTestOutput,
          })

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

          // Record failed attempt for debug endpoint (if we have any code)
          const errorDuration = Date.now() - attemptStartTime
          jobManager.addAttemptRecord(jobId, model, {
            attemptNumber: attempts,
            solution: lastCode || '// Generation failed before producing code',
            prompt: `Challenge: ${challenge}${attemptFeedback ? `\nFeedback from previous attempt:\n${attemptFeedback}` : ''}`,
            feedback: attemptFeedback || undefined,
            duration: errorDuration,
            testOutput: {
              passed: false,
              numTests: 0,
              numPassed: 0,
              numFailed: 1,
              failures: [{ testName: 'error', error: message }],
            },
          })
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

    // === REFINEMENT ROUND ===
    if (refinementRound && job.results.some((r) => r.passed)) {
      // Find the best performer from initial round
      const passedResults = job.results.filter((r) => r.passed)
      const rankedResults = [...passedResults].sort((a, b) => {
        if (isReact) {
          const aMetrics = a.metrics as { fps?: number } | undefined
          const bMetrics = b.metrics as { fps?: number } | undefined
          return (bMetrics?.fps ?? 0) - (aMetrics?.fps ?? 0)
        } else {
          const aMetrics = a.metrics as { benchmarks?: Array<{ hz: number }> } | undefined
          const bMetrics = b.metrics as { benchmarks?: Array<{ hz: number }> } | undefined
          return (bMetrics?.benchmarks?.[0]?.hz ?? 0) - (aMetrics?.benchmarks?.[0]?.hz ?? 0)
        }
      })

      const winner = rankedResults[0]
      refinementWinner = winner.model
      const winnerMetricsRaw = winner.metrics as {
        fps?: number
        bundleSize?: number
        benchmarks?: Array<{ hz: number; name?: string }>
      } | undefined

      // Load the winning solution code
      const winnerSolutionPath = join(challengePath, 'solutions', `${winner.model}.${fileExt}`)
      const winningSolution = await readFile(winnerSolutionPath, 'utf-8')

      // Build winner metrics for prompt
      const winnerMetrics: WinnerMetrics = {
        benchmarks: winnerMetricsRaw?.benchmarks?.map((b) => ({
          name: b.name ?? 'benchmark',
          hz: b.hz,
        })),
        reactMetrics: winnerMetricsRaw?.fps
          ? {
              fps: { p95: winnerMetricsRaw.fps },
              renders: { avgCommitTime: 0, renderCount: 0 },
              bundle: { gzipped: winnerMetricsRaw.bundleSize ?? 0 },
              performanceScore: winnerMetricsRaw.fps,
            }
          : undefined,
      }

      // Load original prompt
      const promptPath = join(challengePath, 'prompt.md')
      const originalPrompt = await readFile(promptPath, 'utf-8')

      jobManager.updateProgress(jobId, {
        currentModel: '',
        currentAttempt: 0,
        phase: 'refinement',
        message: `Starting refinement round - all models will attempt to improve ${formatModel(winner.model)}'s winning solution...`,
      })

      for (const model of models) {
        if (job.abortController.signal.aborted) {
          throw new Error('Job cancelled')
        }

        const isWinner = model === winner.model

        jobManager.updateProgress(jobId, {
          currentModel: model,
          currentAttempt: 1,
          phase: 'refinement',
          message: isWinner
            ? `${formatModel(model)} (defending champion) refines their solution...`
            : `${formatModel(model)} studies ${formatModel(winner.model)}'s approach...`,
        })

        const refinementPrompt = buildRefinementPrompt({
          originalPrompt,
          winningSolution,
          winnerModel: winner.model,
          winnerMetrics,
          isWinner,
          challengeType: challengeConfig.type,
        })

        try {
          const code = await generateSolution({
            model,
            challenge,
            customPrompt: refinementPrompt,
          })

          // Write refined solution
          const refinedSolutionPath = join(challengePath, 'solutions', `${model}-refined.${fileExt}`)
          await writeFile(refinedSolutionPath, code)

          // Write as active solution for testing
          const activeSolutionPath = join(challengePath, `solution.${fileExt}`)
          await writeFile(activeSolutionPath, code)

          // Test refined solution
          jobManager.updateProgress(jobId, {
            phase: 'testing',
            message: `Testing ${formatModel(model)}'s refined solution...`,
          })

          const testResult = await runTests(challenge)

          if (testResult.passed) {
            if (isReact) {
              const perfMetrics = await runPerfTest({
                componentPath: activeSolutionPath,
                thresholds: challengeConfig.performanceThresholds,
              })

              const improvement = calculateImprovement(winnerMetrics, { reactMetrics: perfMetrics }, 'react-component')

              refinementResults.push({
                model,
                attempts: 1,
                passed: perfMetrics.passed,
                reactMetrics: perfMetrics,
                codeSize: code.length,
                isRefinement: true,
                refinedFrom: winner.model,
              })

              jobManager.updateProgress(jobId, {
                phase: 'refinement',
                message: `${formatModel(model)} ${improvement.improved ? 'improved' : 'did not improve'}: ${improvement.description}`,
              })
            } else {
              const benchResult = await runBenchmarks(challenge)
              const improvement = calculateImprovement(winnerMetrics, { benchmarks: benchResult }, 'function')

              refinementResults.push({
                model,
                attempts: 1,
                passed: true,
                benchmarks: benchResult,
                codeSize: code.length,
                isRefinement: true,
                refinedFrom: winner.model,
              })

              jobManager.updateProgress(jobId, {
                phase: 'refinement',
                message: `${formatModel(model)} ${improvement.improved ? 'improved' : 'did not improve'}: ${improvement.description}`,
              })
            }
          } else {
            refinementResults.push({
              model,
              attempts: 1,
              passed: false,
              codeSize: code.length,
              error: testResult.errors.join('\n').slice(0, 500),
              isRefinement: true,
              refinedFrom: winner.model,
            })

            jobManager.updateProgress(jobId, {
              phase: 'refinement',
              message: `${formatModel(model)}'s refinement failed tests`,
            })
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          refinementResults.push({
            model,
            attempts: 1,
            passed: false,
            error: message.slice(0, 500),
            isRefinement: true,
            refinedFrom: winner.model,
          })
        }
      }
    }

    // Record results
    await recordResult({
      challenge,
      results: job.results as any,
      config: { maxAttempts, models },
      type: challengeConfig.type,
      refinementEnabled: refinementRound,
      refinementResults: refinementResults.length > 0 ? refinementResults : undefined,
      refinementWinner,
    })

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
