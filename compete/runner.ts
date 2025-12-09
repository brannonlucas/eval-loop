#!/usr/bin/env bun
import { parseArgs } from 'util'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { generateSolution, validateApiKeys, type ModelId } from './lib/ai-generator'
import { runTests, runBenchmarks, type TestRunOptions } from './lib/vitest-runner'
import {
  recordResult,
  getLeaderboard,
  printResults,
  getBestResultsPerModel,
  type ModelResult,
} from './lib/results'
import { loadChallengeConfig, isReactChallenge, assertChallengeValid } from './lib/challenge-config'
import { runPerfTest } from './lib/playwright-runner'
import type { ReactPerfMetrics } from './lib/react-metrics'
import { calculatePerfScore } from './lib/react-metrics'
import {
  setupExternalWorkspace,
  cleanupOldWorkspaces,
  isExternalRepoChallenge,
  type WorkspaceContext,
} from './lib/workspace'
import {
  buildRefinementPrompt,
  calculateImprovement,
  type WinnerMetrics,
} from './lib/refinement-prompt'

interface CompetitionConfig {
  challenge: string
  models: ModelId[]
  maxAttempts: number
  refinementRound?: boolean
}

const DEFAULT_MODELS: ModelId[] = ['sonnet', 'gpt4']
const DEFAULT_MAX_ATTEMPTS = 5

interface CompetitionResults {
  initial: ModelResult[]
  refinement?: ModelResult[]
  refinementWinner?: string
}

async function runCompetition(config: CompetitionConfig): Promise<CompetitionResults> {
  const { challenge, models, maxAttempts, refinementRound } = config
  const results: ModelResult[] = []

  // Clean up old workspaces at start
  await cleanupOldWorkspaces()

  // Load challenge config to determine type
  const challengePath = join(process.cwd(), 'compete/challenges', challenge)
  const challengeConfig = await loadChallengeConfig(challengePath)

  // Validate challenge has required files before starting
  assertChallengeValid(challengePath, challengeConfig)

  // Validate API keys for all requested models before starting
  const missingKeys = validateApiKeys(models)
  if (missingKeys.length > 0) {
    console.error('\nMissing API keys:')
    for (const key of missingKeys) {
      console.error(`  - ${key}`)
    }
    console.error('\nAdd these to your .env file (see .env.example)')
    process.exit(1)
  }

  const isReact = isReactChallenge(challengeConfig)
  const isExternal = isExternalRepoChallenge(challengeConfig)
  const fileExt = isReact ? 'tsx' : 'ts'

  console.log(`\n=== Running Competition: ${challenge} ===`)
  console.log(`Type: ${challengeConfig.type}${isExternal ? ' (external repo)' : ''}`)
  console.log(`Models: ${models.join(', ')}`)
  console.log(`Max attempts per model: ${maxAttempts}\n`)

  // Set up workspace for external repo challenges
  let workspace: WorkspaceContext | null = null
  if (isExternal && challengeConfig.externalRepo) {
    console.log('  Setting up isolated workspace...')
    workspace = await setupExternalWorkspace({
      challengeName: challenge,
      challengePath,
      externalRepo: challengeConfig.externalRepo,
      fileExt,
      keepWorkspace: process.env.KEEP_WORKSPACE === 'true',
    })
    console.log(`  Workspace: ${workspace.workspacePath}`)
  }

  try {
    for (const model of models) {
      console.log(`\n--- ${model.toUpperCase()} ---`)

      let attempts = 0
      let feedback = ''
      let lastCode = ''

      while (attempts < maxAttempts) {
        attempts++
        console.log(`Attempt ${attempts}/${maxAttempts}...`)

        try {
          // 1. Generate solution
          console.log('  Generating solution...')
          const code = await generateSolution({ model, challenge, feedback })
          lastCode = code

          // 2. Write solution file
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
            const solutionPath = join(
              process.cwd(),
              'compete/challenges',
              challenge,
              'solutions',
              `${model}.${fileExt}`
            )
            await mkdir(join(process.cwd(), 'compete/challenges', challenge, 'solutions'), {
              recursive: true,
            })
            await writeFile(solutionPath, code)

            // Also write as solution.ts(x) for the test to import
            activeSolutionPath = join(
              process.cwd(),
              'compete/challenges',
              challenge,
              `solution.${fileExt}`
            )
            await writeFile(activeSolutionPath, code)
          }

          // 3. Run correctness tests
          console.log('  Running tests...')
          const testRunOptions: TestRunOptions = workspace
            ? { workspacePath: workspace.workspacePath, testFilePath: workspace.testPath }
            : {}
          const testResult = await runTests(challenge, testRunOptions)

          if (testResult.passed) {
            console.log('  Tests PASSED!')

            if (isReact) {
              // 4a. Run React performance tests
              console.log('  Running performance tests...')
              const perfMetrics = await runReactPerfTest(activeSolutionPath, challengeConfig)

              results.push({
                model,
                attempts,
                passed: perfMetrics.passed,
                reactMetrics: perfMetrics,
                codeSize: code.length,
                duration: testResult.duration,
              })
            } else {
              // 4b. Run benchmarks for function challenges
              console.log('  Running benchmarks...')
              const benchResult = await runBenchmarks(challenge)

              results.push({
                model,
                attempts,
                passed: true,
                benchmarks: benchResult,
                codeSize: code.length,
                duration: testResult.duration,
              })
            }

            console.log(`  Completed in ${attempts} attempt(s)`)
            break
          } else {
            console.log(`  Tests FAILED`)
            // Feed errors back for retry
            feedback = testResult.errors.join('\n')
            console.log(`  Feedback: ${feedback.slice(0, 200)}...`)
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.log(`  Error: ${message}`)
          feedback = `Error generating/running code: ${message}`
        }
      }

      if (attempts >= maxAttempts && !results.find((r) => r.model === model && r.passed)) {
        results.push({
          model,
          attempts,
          passed: false,
          codeSize: lastCode.length,
          error: feedback.slice(0, 2000),
        })
        console.log(`  Failed after ${maxAttempts} attempts`)
      }
    }
  } finally {
    // Clean up workspace
    if (workspace) {
      console.log('\n  Cleaning up workspace...')
      await workspace.cleanup()
    }
  }

  // === REFINEMENT ROUND ===
  let refinementResults: ModelResult[] | undefined
  let refinementWinner: string | undefined

  if (refinementRound && results.some((r) => r.passed)) {
    // Find the best performer from initial round
    const passedResults = results.filter((r) => r.passed)
    const rankedResults = [...passedResults].sort((a, b) => {
      if (isReact) {
        const aScore = a.reactMetrics ? calculatePerfScore(a.reactMetrics) : 0
        const bScore = b.reactMetrics ? calculatePerfScore(b.reactMetrics) : 0
        return bScore - aScore
      } else {
        const aHz = a.benchmarks?.[0]?.hz ?? 0
        const bHz = b.benchmarks?.[0]?.hz ?? 0
        return bHz - aHz
      }
    })

    const winner = rankedResults[0]
    refinementWinner = winner.model

    // Load the winning solution code
    const winnerSolutionPath = join(
      process.cwd(),
      'compete/challenges',
      challenge,
      'solutions',
      `${winner.model}.${fileExt}`
    )
    const winningSolution = await readFile(winnerSolutionPath, 'utf-8')

    // Build winner metrics for prompt
    const winnerMetrics: WinnerMetrics = {
      benchmarks: winner.benchmarks,
      reactMetrics: winner.reactMetrics
        ? {
            fps: winner.reactMetrics.fps,
            renders: winner.reactMetrics.renders,
            bundle: winner.reactMetrics.bundle,
            performanceScore: calculatePerfScore(winner.reactMetrics),
          }
        : undefined,
    }

    // Load original prompt
    const promptPath = join(challengePath, 'prompt.md')
    const originalPrompt = await readFile(promptPath, 'utf-8')

    console.log(`\n${'═'.repeat(50)}`)
    console.log('           REFINEMENT ROUND')
    console.log(`${'═'.repeat(50)}`)
    console.log(`  Reference: ${winner.model}'s solution`)
    if (isReact && winner.reactMetrics) {
      console.log(`  Score: ${calculatePerfScore(winner.reactMetrics)}`)
    } else if (winner.benchmarks?.[0]) {
      console.log(`  Performance: ${winner.benchmarks[0].hz.toLocaleString()} ops/sec`)
    }
    console.log('')

    refinementResults = []

    for (const model of models) {
      const isWinner = model === winner.model
      console.log(`--- ${model.toUpperCase()} ${isWinner ? '(defending)' : ''} ---`)

      const refinementPrompt = buildRefinementPrompt({
        originalPrompt,
        winningSolution,
        winnerModel: winner.model,
        winnerMetrics,
        isWinner,
        challengeType: challengeConfig.type,
      })

      try {
        console.log('  Generating refined solution...')
        const code = await generateSolution({
          model,
          challenge,
          customPrompt: refinementPrompt,
        })

        // Write refined solution
        const refinedSolutionPath = join(
          process.cwd(),
          'compete/challenges',
          challenge,
          'solutions',
          `${model}-refined.${fileExt}`
        )
        await writeFile(refinedSolutionPath, code)

        // Write as active solution for testing
        const activeSolutionPath = join(challengePath, `solution.${fileExt}`)
        await writeFile(activeSolutionPath, code)

        // Test refined solution
        console.log('  Running tests...')
        const testResult = await runTests(challenge)

        if (testResult.passed) {
          console.log('  Tests PASSED!')

          if (isReact) {
            const perfMetrics = await runReactPerfTest(activeSolutionPath, challengeConfig)
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

            console.log(`  ${improvement.improved ? '✓ improved' : '✗ not improved'}: ${improvement.description}`)
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

            console.log(`  ${improvement.improved ? '✓ improved' : '✗ not improved'}: ${improvement.description}`)
          }
        } else {
          console.log('  Tests FAILED (refinement rejected)')
          refinementResults.push({
            model,
            attempts: 1,
            passed: false,
            codeSize: code.length,
            error: testResult.errors.join('\n').slice(0, 2000),
            isRefinement: true,
            refinedFrom: winner.model,
          })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.log(`  Error: ${message}`)
        refinementResults.push({
          model,
          attempts: 1,
          passed: false,
          error: message.slice(0, 2000),
          isRefinement: true,
          refinedFrom: winner.model,
        })
      }
    }
  }

  // Save results
  await recordResult({
    challenge,
    results,
    config: { maxAttempts, models },
    type: challengeConfig.type,
    refinementEnabled: refinementRound,
    refinementResults,
    refinementWinner,
  })

  return { initial: results, refinement: refinementResults, refinementWinner }
}

async function runReactPerfTest(
  componentPath: string,
  challengeConfig: Awaited<ReturnType<typeof loadChallengeConfig>>
): Promise<ReactPerfMetrics> {
  // Load perf test configuration from challenge if exists
  const perfTestPath = join(
    componentPath.replace(/solution\.tsx$/, ''),
    'perf-config.ts'
  )

  let componentProps = {}
  let interactionScript = undefined

  try {
    const perfConfig = await import(perfTestPath)
    componentProps = perfConfig.componentProps || {}
    interactionScript = perfConfig.interactionScript
  } catch {
    // No custom perf config, use defaults
  }

  return runPerfTest({
    componentPath,
    componentProps,
    interactionScript,
    thresholds: challengeConfig.performanceThresholds,
  })
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      challenge: { type: 'string', short: 'c' },
      models: { type: 'string', short: 'm' },
      attempts: { type: 'string', short: 'a' },
      refine: { type: 'boolean', short: 'r' },
      leaderboard: { type: 'boolean', short: 'l' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.help) {
    console.log(`
AI Code Competition Runner

Usage:
  bun run compete --challenge <name> [options]

Quick Start:
  1. Set up API keys in .env (see .env.example)
  2. Run: bun run compete -c fastest-sort

Options:
  -c, --challenge <name>   Challenge to run (required)
  -m, --models <list>      Comma-separated list of models (default: sonnet,gpt4)
  -a, --attempts <n>       Max attempts per model (default: 5)
  -r, --refine             Enable refinement round after initial competition
  -l, --leaderboard        Show leaderboard for challenge
  -h, --help               Show this help

Available models:
  sonnet   Claude Sonnet 4 (Anthropic) - requires ANTHROPIC_API_KEY
  opus     Claude Opus 4.5 (Anthropic) - requires ANTHROPIC_API_KEY
  gpt4     GPT-4o (OpenAI) - requires OPENAI_API_KEY
  gemini   Gemini 1.5 Pro (Google) - requires GOOGLE_API_KEY

Challenge Types:
  function         Algorithm challenges with vitest benchmarks (ops/sec)
  react-component  React component challenges with Playwright perf tests (FPS)

Challenge Structure:
  compete/challenges/<name>/
    prompt.md         AI prompt template (required)
    spec.test.ts(x)   Correctness tests (required)
    spec.bench.ts     Performance benchmarks (optional, function type)
    challenge.config.json  Custom config (optional)

Examples:
  bun run compete -c fastest-sort                    # Basic competition
  bun run compete -c fastest-sort -m opus -a 1      # Single model, 1 attempt
  bun run compete -c fastest-sort --refine          # With refinement round
  bun run compete -c virtualized-list -m sonnet,gpt4,opus
  bun run compete -c fastest-sort --leaderboard     # View past results

Dashboard:
  bun run serve   # Start web dashboard at http://localhost:3456
`)
    return
  }

  if (!values.challenge) {
    console.error('Error: --challenge is required')
    console.log('Run with --help for usage')
    process.exit(1)
  }

  if (values.leaderboard) {
    await getLeaderboard(values.challenge)
    return
  }

  const models = values.models
    ? (values.models.split(',') as ModelId[])
    : DEFAULT_MODELS

  const maxAttempts = values.attempts
    ? parseInt(values.attempts, 10)
    : DEFAULT_MAX_ATTEMPTS

  const competitionResults = await runCompetition({
    challenge: values.challenge,
    models,
    maxAttempts,
    refinementRound: values.refine,
  })

  // Print initial round results
  printResults(competitionResults.initial)

  // Print refinement results if enabled
  if (competitionResults.refinement && competitionResults.refinement.length > 0) {
    console.log('\n=== Refinement Round Results ===\n')
    printResults(competitionResults.refinement)
  }
}

main().catch(console.error)
