/**
 * Competition Route Handler
 *
 * POST /api/compete - Run a competition with SSE progress streaming
 */

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { CompeteRequest } from '../types'
import { createSSEStream, sseHeaders } from '../sse/stream'
import { jobManager } from '../jobs/manager'
import { generateSolution, type ModelId } from '../../lib/ai-generator'
import { runTests, runBenchmarks, type TestRunOptions } from '../../lib/vitest-runner'
import { loadChallengeConfig, isReactChallenge } from '../../lib/challenge-config'
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

export function handleCompete(body: unknown): Response {
  const req = body as CompeteRequest

  if (!req.challenge) {
    return json({ error: 'challenge is required' }, 400)
  }

  const models = req.models || DEFAULT_MODELS
  const maxAttempts = req.maxAttempts || DEFAULT_MAX_ATTEMPTS
  const useSSE = req.stream !== false

  if (useSSE) {
    // SSE streaming response
    const sse = createSSEStream()

    const job = jobManager.createJob({
      config: { challenge: req.challenge, models, maxAttempts },
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
      config: { challenge: req.challenge, models, maxAttempts },
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

  const { challenge, models, maxAttempts } = job.config
  let workspace: WorkspaceContext | null = null

  try {
    const challengePath = await resolveChallengePath(challenge)
    const challengeConfig = await loadChallengeConfig(challengePath)
    const isReact = isReactChallenge(challengeConfig)
    const isExternal = isExternalRepoChallenge(challengeConfig)
    const fileExt = isReact ? 'tsx' : 'ts'

    // Set up workspace for external repo challenges
    if (isExternal && challengeConfig.externalRepo) {
      jobManager.updateProgress(jobId, {
        currentModel: '',
        currentAttempt: 0,
        phase: 'setup',
        message: 'Setting up isolated workspace...',
      })

      workspace = await setupExternalWorkspace({
        challengeName: challenge,
        challengePath,
        externalRepo: challengeConfig.externalRepo,
        fileExt,
        keepWorkspace: false,
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
        message: `Starting ${model}...`,
      })

      let attempts = 0
      let feedback = ''
      let lastCode = ''

      while (attempts < maxAttempts) {
        if (job.abortController.signal.aborted) {
          throw new Error('Job cancelled')
        }

        attempts++

        jobManager.updateProgress(jobId, {
          currentAttempt: attempts,
          phase: 'generating',
          message: `Generating solution (attempt ${attempts}/${maxAttempts})`,
        })

        try {
          // Generate solution
          const code = await generateSolution({ model, challenge, feedback })
          lastCode = code

          // Write solution file
          jobManager.updateProgress(jobId, {
            phase: 'writing',
            message: 'Writing solution file',
          })

          let activeSolutionPath: string

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
            message: 'Running tests',
          })

          const testRunOptions: TestRunOptions = workspace
            ? { workspacePath: workspace.workspacePath, testFilePath: workspace.testPath }
            : {}
          const testResult = await runTests(challenge, testRunOptions)

          if (testResult.passed) {
            if (isReact) {
              jobManager.updateProgress(jobId, {
                phase: 'analyzing',
                message: 'Running performance tests',
              })

              const perfMetrics = await runPerfTest({
                componentPath: activeSolutionPath,
                thresholds: challengeConfig.performanceThresholds,
              })

              jobManager.addResult(jobId, {
                model,
                passed: perfMetrics.passed,
                attempts,
                metrics: {
                  fps: perfMetrics.fps.p95,
                  avgRenderTime: perfMetrics.renders.avgCommitTime,
                  bundleSize: perfMetrics.bundle.gzipped,
                },
              })
            } else {
              jobManager.updateProgress(jobId, {
                phase: 'benchmarking',
                message: 'Running benchmarks',
              })

              const benchResult = await runBenchmarks(challenge)

              jobManager.addResult(jobId, {
                model,
                passed: true,
                attempts,
                metrics: { benchmarks: benchResult },
              })
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
        jobManager.addResult(jobId, {
          model,
          passed: false,
          attempts,
          error: feedback.slice(0, 500),
        })
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
