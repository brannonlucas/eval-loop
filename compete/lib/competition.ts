/**
 * Shared Competition Engine
 *
 * Core competition loop used by both the CLI runner and the API server.
 * Callers provide hooks for progress reporting, result tracking, etc.
 */

import { writeFile, mkdir, readFile } from 'fs/promises'
import { join } from 'path'
import { generateSolution } from './ai-generator'
import { runTests, runBenchmarks, type TestRunOptions } from './vitest-runner'
import { loadChallengeConfig, isReactChallenge, assertChallengeValid } from './challenge-config'
import { runPerfTest } from './playwright-runner'
import { calculatePerfScore } from './react-metrics'
import {
  setupExternalWorkspace,
  isExternalRepoChallenge,
  type WorkspaceContext,
} from './workspace'
import {
  buildRefinementPrompt,
  calculateImprovement,
  type WinnerMetrics,
} from './refinement-prompt'
import { recordResult, type ModelResult } from './results'

export type { ModelResult } from './results'

export type Phase = 'setup' | 'generating' | 'writing' | 'testing' | 'benchmarking' | 'analyzing' | 'refinement'

export interface CompetitionConfig {
  challenge: string
  challengePath: string
  models: string[]
  maxAttempts: number
  refinementRound?: boolean
  keepWorkspace?: boolean
  captureTestOutput?: boolean
}

export interface AttemptInfo {
  attempt: number
  code: string
  feedback: string
  duration: number
  testPassed: boolean
  testErrors: string[]
  rawTestOutput?: string
}

export interface CompetitionHooks {
  onProgress?: (model: string, attempt: number, phase: Phase, message: string) => void
  onModelResult?: (result: ModelResult) => void
  onAttempt?: (model: string, info: AttemptInfo) => void
  shouldAbort?: () => boolean
}

export interface CompetitionOutput {
  results: ModelResult[]
  refinementResults?: ModelResult[]
  refinementWinner?: string
}

/**
 * Write solution to the appropriate location (workspace or challenge dir)
 */
async function writeSolution(opts: {
  code: string
  model: string
  challengePath: string
  fileExt: string
  workspace: WorkspaceContext | null
}): Promise<string> {
  const { code, model, challengePath, fileExt, workspace } = opts

  if (workspace) {
    await mkdir(join(workspace.workspacePath, 'solutions'), { recursive: true })
    await writeFile(join(workspace.workspacePath, 'solutions', `${model}.${fileExt}`), code)
    await writeFile(workspace.solutionPath, code)
    return workspace.solutionPath
  }

  await mkdir(join(challengePath, 'solutions'), { recursive: true })
  await writeFile(join(challengePath, 'solutions', `${model}.${fileExt}`), code)

  const activePath = join(challengePath, `solution.${fileExt}`)
  await writeFile(activePath, code)
  return activePath
}

/**
 * Run React performance test with optional custom config from challenge dir
 */
async function runReactPerfTest(
  componentPath: string,
  challengeConfig: Awaited<ReturnType<typeof loadChallengeConfig>>
) {
  const perfTestPath = join(componentPath.replace(/solution\.tsx$/, ''), 'perf-config.ts')
  let componentProps = {}
  let interactionScript

  try {
    const perfConfig = await import(perfTestPath)
    componentProps = perfConfig.componentProps || {}
    interactionScript = perfConfig.interactionScript
  } catch {
    // No custom perf config
  }

  return runPerfTest({
    componentPath,
    componentProps,
    interactionScript,
    thresholds: challengeConfig.performanceThresholds,
  })
}

/**
 * Run the competition: for each model, generate → test → benchmark solutions
 */
export async function runCompetition(
  config: CompetitionConfig,
  hooks?: CompetitionHooks
): Promise<CompetitionOutput> {
  const { challenge, challengePath, models, maxAttempts, refinementRound, keepWorkspace, captureTestOutput } = config
  const results: ModelResult[] = []
  const emit = hooks?.onProgress ?? (() => {})
  const checkAbort = hooks?.shouldAbort ?? (() => false)

  const challengeConfig = await loadChallengeConfig(challengePath)
  assertChallengeValid(challengePath, challengeConfig)

  const isReact = isReactChallenge(challengeConfig)
  const isExternal = isExternalRepoChallenge(challengeConfig)
  const fileExt = isReact ? 'tsx' : 'ts'

  // Set up workspace for external repo challenges
  let workspace: WorkspaceContext | null = null
  if (isExternal && challengeConfig.externalRepo) {
    emit('', 0, 'setup', `Preparing workspace for ${challenge}...`)
    workspace = await setupExternalWorkspace({
      challengeName: challenge,
      challengePath,
      externalRepo: challengeConfig.externalRepo,
      fileExt,
      keepWorkspace: keepWorkspace ?? false,
    })
  }

  try {
    for (const model of models) {
      if (checkAbort()) throw new Error('Cancelled')

      let attempts = 0
      let feedback = ''
      let lastCode = ''

      while (attempts < maxAttempts) {
        if (checkAbort()) throw new Error('Cancelled')
        attempts++

        emit(model, attempts, 'generating', `${model} attempt ${attempts}/${maxAttempts}`)
        const startTime = Date.now()

        try {
          const code = await generateSolution({ model, challenge, feedback })
          lastCode = code
          const duration = Date.now() - startTime

          emit(model, attempts, 'writing', 'Writing solution...')
          const activeSolutionPath = await writeSolution({
            code, model, challengePath, fileExt, workspace,
          })

          emit(model, attempts, 'testing', 'Testing...')
          const testRunOptions: TestRunOptions = workspace
            ? { workspacePath: workspace.workspacePath, testFilePath: workspace.testPath, captureFullOutput: captureTestOutput }
            : { captureFullOutput: captureTestOutput }
          const testResult = await runTests(challenge, testRunOptions)

          hooks?.onAttempt?.(model, {
            attempt: attempts, code, feedback, duration,
            testPassed: testResult.passed,
            testErrors: testResult.errors,
            rawTestOutput: testResult.rawOutput,
          })

          if (testResult.passed) {
            let result: ModelResult

            if (isReact) {
              emit(model, attempts, 'analyzing', 'Measuring performance...')
              const perfMetrics = await runReactPerfTest(activeSolutionPath, challengeConfig)
              result = {
                model, attempts, passed: perfMetrics.passed,
                reactMetrics: perfMetrics, codeSize: code.length, duration: testResult.duration,
              }
            } else {
              emit(model, attempts, 'benchmarking', 'Benchmarking...')
              const benchResult = await runBenchmarks(challenge)
              result = {
                model, attempts, passed: true,
                benchmarks: benchResult, codeSize: code.length, duration: testResult.duration,
              }
            }

            results.push(result)
            hooks?.onModelResult?.(result)
            break
          } else {
            feedback = testResult.errors.join('\n')
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          feedback = `Error: ${message}`

          hooks?.onAttempt?.(model, {
            attempt: attempts, code: lastCode, feedback,
            duration: Date.now() - startTime,
            testPassed: false, testErrors: [message],
          })
        }
      }

      if (attempts >= maxAttempts && !results.find(r => r.model === model && r.passed)) {
        const result: ModelResult = {
          model, attempts, passed: false,
          codeSize: lastCode.length, error: feedback.slice(0, 2000),
        }
        results.push(result)
        hooks?.onModelResult?.(result)
      }
    }
  } finally {
    if (workspace) await workspace.cleanup()
  }

  // Refinement round
  let refinementResults: ModelResult[] | undefined
  let refinementWinner: string | undefined

  if (refinementRound && results.some(r => r.passed)) {
    const refined = await runRefinement({
      challenge, challengePath, challengeConfig, models, results,
      isReact, fileExt, emit, checkAbort, onModelResult: hooks?.onModelResult,
    })
    refinementResults = refined.results
    refinementWinner = refined.winner
  }

  // Record results to disk
  await recordResult({
    challenge, results,
    config: { maxAttempts, models },
    type: challengeConfig.type,
    refinementEnabled: refinementRound,
    refinementResults,
    refinementWinner,
  })

  return { results, refinementResults, refinementWinner }
}

/**
 * Refinement round: all models try to improve the winning solution
 */
async function runRefinement(opts: {
  challenge: string
  challengePath: string
  challengeConfig: Awaited<ReturnType<typeof loadChallengeConfig>>
  models: string[]
  results: ModelResult[]
  isReact: boolean
  fileExt: string
  emit: (model: string, attempt: number, phase: Phase, message: string) => void
  checkAbort: () => boolean
  onModelResult?: (result: ModelResult) => void
}): Promise<{ results: ModelResult[]; winner: string }> {
  const { challenge, challengePath, challengeConfig, models, results, isReact, fileExt, emit, checkAbort, onModelResult } = opts
  const refinementResults: ModelResult[] = []

  // Find best performer from initial round
  const passedResults = results.filter(r => r.passed)
  const ranked = [...passedResults].sort((a, b) => {
    if (isReact) {
      return (b.reactMetrics ? calculatePerfScore(b.reactMetrics) : 0) -
             (a.reactMetrics ? calculatePerfScore(a.reactMetrics) : 0)
    }
    return (b.benchmarks?.[0]?.hz ?? 0) - (a.benchmarks?.[0]?.hz ?? 0)
  })

  const winner = ranked[0]
  const winningSolution = await readFile(
    join(challengePath, 'solutions', `${winner.model}.${fileExt}`), 'utf-8'
  )

  const winnerMetrics: WinnerMetrics = {
    benchmarks: winner.benchmarks,
    reactMetrics: winner.reactMetrics ? {
      fps: winner.reactMetrics.fps,
      renders: winner.reactMetrics.renders,
      bundle: winner.reactMetrics.bundle,
      performanceScore: calculatePerfScore(winner.reactMetrics),
    } : undefined,
  }

  const originalPrompt = await readFile(join(challengePath, 'prompt.md'), 'utf-8')

  emit('', 0, 'refinement', `Refinement round — reference: ${winner.model}`)

  for (const model of models) {
    if (checkAbort()) throw new Error('Cancelled')

    const isWinner = model === winner.model
    emit(model, 1, 'refinement', `${model}${isWinner ? ' (defending)' : ''} refining...`)

    const refinementPrompt = buildRefinementPrompt({
      originalPrompt, winningSolution,
      winnerModel: winner.model, winnerMetrics,
      isWinner, challengeType: challengeConfig.type,
    })

    try {
      const code = await generateSolution({ model, challenge, customPrompt: refinementPrompt })

      await writeFile(join(challengePath, 'solutions', `${model}-refined.${fileExt}`), code)
      const activeSolutionPath = join(challengePath, `solution.${fileExt}`)
      await writeFile(activeSolutionPath, code)

      emit(model, 1, 'testing', 'Testing refined solution...')
      const testResult = await runTests(challenge)

      if (testResult.passed) {
        let result: ModelResult

        if (isReact) {
          const perfMetrics = await runReactPerfTest(activeSolutionPath, challengeConfig)
          const improvement = calculateImprovement(winnerMetrics, { reactMetrics: perfMetrics }, 'react-component')
          result = {
            model, attempts: 1, passed: perfMetrics.passed,
            reactMetrics: perfMetrics, codeSize: code.length,
            isRefinement: true, refinedFrom: winner.model,
          }
          emit(model, 1, 'refinement', `${improvement.improved ? 'Improved' : 'Not improved'}: ${improvement.description}`)
        } else {
          const benchResult = await runBenchmarks(challenge)
          const improvement = calculateImprovement(winnerMetrics, { benchmarks: benchResult }, 'function')
          result = {
            model, attempts: 1, passed: true,
            benchmarks: benchResult, codeSize: code.length,
            isRefinement: true, refinedFrom: winner.model,
          }
          emit(model, 1, 'refinement', `${improvement.improved ? 'Improved' : 'Not improved'}: ${improvement.description}`)
        }

        refinementResults.push(result)
        onModelResult?.(result)
      } else {
        const result: ModelResult = {
          model, attempts: 1, passed: false,
          codeSize: code.length, error: testResult.errors.join('\n').slice(0, 2000),
          isRefinement: true, refinedFrom: winner.model,
        }
        refinementResults.push(result)
        onModelResult?.(result)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const result: ModelResult = {
        model, attempts: 1, passed: false,
        error: message.slice(0, 2000),
        isRefinement: true, refinedFrom: winner.model,
      }
      refinementResults.push(result)
      onModelResult?.(result)
    }
  }

  return { results: refinementResults, winner: winner.model }
}
