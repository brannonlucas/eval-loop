#!/usr/bin/env bun
import { parseArgs } from 'util'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { generateSolution, type ModelId } from './lib/ai-generator'
import { runTests, runBenchmarks, type TestRunOptions } from './lib/vitest-runner'
import { recordResult, getLeaderboard, printResults, type ModelResult } from './lib/results'
import { loadChallengeConfig, isReactChallenge } from './lib/challenge-config'
import { runPerfTest } from './lib/playwright-runner'
import type { ReactPerfMetrics } from './lib/react-metrics'
import {
  setupExternalWorkspace,
  cleanupOldWorkspaces,
  isExternalRepoChallenge,
  type WorkspaceContext,
} from './lib/workspace'

interface CompetitionConfig {
  challenge: string
  models: ModelId[]
  maxAttempts: number
}

const DEFAULT_MODELS: ModelId[] = ['sonnet', 'gpt4']
const DEFAULT_MAX_ATTEMPTS = 5

async function runCompetition(config: CompetitionConfig): Promise<ModelResult[]> {
  const { challenge, models, maxAttempts } = config
  const results: ModelResult[] = []

  // Clean up old workspaces at start
  await cleanupOldWorkspaces()

  // Load challenge config to determine type
  const challengePath = join(process.cwd(), 'compete/challenges', challenge)
  const challengeConfig = await loadChallengeConfig(challengePath)
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
          error: feedback.slice(0, 500),
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

  // Save results
  await recordResult(challenge, results, { maxAttempts, models }, challengeConfig.type)

  return results
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
      leaderboard: { type: 'boolean', short: 'l' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.help) {
    console.log(`
AI Code Competition Runner

Usage:
  bun run compete --challenge <name> [options]

Options:
  -c, --challenge <name>   Challenge to run (required)
  -m, --models <list>      Comma-separated list of models (default: sonnet,gpt4)
  -a, --attempts <n>       Max attempts per model (default: 5)
  -l, --leaderboard        Show leaderboard for challenge
  -h, --help               Show this help

Available models: sonnet, opus, gpt4, gemini

Challenge Types:
  - function: Traditional algorithm challenges (vitest benchmarks)
  - react-component: React component challenges (Playwright FPS/render tests)

Examples:
  bun run compete -c fastest-sort
  bun run compete -c virtualized-list -m sonnet,gpt4,opus -a 3
  bun run compete -c virtualized-list --leaderboard
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

  const results = await runCompetition({
    challenge: values.challenge,
    models,
    maxAttempts,
  })

  printResults(results)
}

main().catch(console.error)
