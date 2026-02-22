#!/usr/bin/env bun
/**
 * CLI Competition Runner
 *
 * Thin CLI wrapper around the shared competition engine.
 * Handles argument parsing and delegates to lib/competition.ts.
 */

import { parseArgs } from 'util'
import { join } from 'path'
import { validateApiKeys, getModelIds, getModelConfig } from './lib/ai-generator'
import { runCompetition } from './lib/competition'
import { getLeaderboard, printResults } from './lib/results'
import { cleanupOldWorkspaces } from './lib/workspace'
import { scaffoldChallenge, type ChallengeTemplate } from './lib/scaffold'
import { linkExternalRepo, showLinkHelp } from './lib/link-external'

const DEFAULT_MODELS = ['sonnet', 'gpt4']
const DEFAULT_MAX_ATTEMPTS = 5

async function main() {
  const args = process.argv.slice(2)

  // Subcommand: init
  if (args[0] === 'init') {
    return handleInit(args.slice(1))
  }

  // Subcommand: link
  if (args[0] === 'link') {
    return handleLink(args.slice(1))
  }

  const { values } = parseArgs({
    args,
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
    await printHelp()
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

  const models = values.models ? values.models.split(',') : DEFAULT_MODELS
  const maxAttempts = values.attempts ? parseInt(values.attempts, 10) : DEFAULT_MAX_ATTEMPTS
  const challengePath = join(process.cwd(), 'compete/challenges', values.challenge)

  // Validate API keys before starting
  const missingKeys = await validateApiKeys(models)
  if (missingKeys.length > 0) {
    console.error('\nMissing API keys:')
    for (const key of missingKeys) console.error(`  - ${key}`)
    console.error('\nAdd these to your .env file (see .env.example)')
    process.exit(1)
  }

  // Clean up old workspaces
  await cleanupOldWorkspaces()

  console.log(`\n=== Running Competition: ${values.challenge} ===`)
  console.log(`Models: ${models.join(', ')}`)
  console.log(`Max attempts per model: ${maxAttempts}\n`)

  const output = await runCompetition(
    {
      challenge: values.challenge,
      challengePath,
      models,
      maxAttempts,
      refinementRound: values.refine,
    },
    {
      onProgress: (model, attempt, phase, message) => {
        if (phase === 'setup' || phase === 'refinement') {
          console.log(`  ${message}`)
        } else if (model) {
          console.log(`  [${model}] ${message}`)
        }
      },
      onModelResult: (result) => {
        const status = result.passed ? 'PASSED' : 'FAILED'
        console.log(`  ${result.model}: ${status} in ${result.attempts} attempt(s)`)
      },
    }
  )

  // Print results
  printResults(output.results)

  if (output.refinementResults && output.refinementResults.length > 0) {
    console.log('\n=== Refinement Round Results ===\n')
    printResults(output.refinementResults)
  }
}

function handleInit(args: string[]) {
  const challengeName = args.find(arg => !arg.startsWith('-'))
  const typeArg = args.find(arg => arg.startsWith('--type='))
  const typeFlag = typeArg?.split('=')[1] as ChallengeTemplate | undefined

  const tIndex = args.indexOf('-t')
  const shortType = tIndex !== -1 ? args[tIndex + 1] as ChallengeTemplate : undefined
  const type = typeFlag || shortType || 'function'

  if (!challengeName) {
    console.log(`
Usage: bun run compete init <name> [--type=function|react]

Create a new challenge with template files.

Arguments:
  <name>              Name for the challenge (kebab-case recommended)

Options:
  -t, --type=<type>   Challenge type: function (default) or react

Examples:
  bun run compete init my-algorithm
  bun run compete init my-component --type=react
`)
    return
  }

  if (type !== 'function' && type !== 'react') {
    console.error(`Invalid type '${type}'. Must be 'function' or 'react'.`)
    process.exit(1)
  }

  return scaffoldChallenge({ name: challengeName, type })
}

async function handleLink(args: string[]) {
  if (args.includes('--help') || args.includes('-h')) {
    showLinkHelp()
    return
  }

  const repoPath = args.find(arg => !arg.startsWith('-'))
  const challengeArg = args.find(arg => arg.startsWith('--name='))
  const challengeNameFlag = challengeArg?.split('=')[1]

  const nIndex = args.indexOf('-n')
  const shortName = nIndex !== -1 ? args[nIndex + 1] : undefined

  const positionalArgs = args.filter(arg => !arg.startsWith('-'))
  const challengeName = challengeNameFlag || shortName || positionalArgs[1]

  const testArg = args.find(arg => arg.startsWith('--test='))
  const testFileFlag = testArg?.split('=')[1]
  const tIndex = args.indexOf('--test')
  const testFile = testFileFlag || (tIndex !== -1 ? args[tIndex + 1] : undefined)

  const typeArg = args.find(arg => arg.startsWith('--type='))
  const typeFlag = typeArg?.split('=')[1] as 'function' | 'react-component' | undefined

  if (!repoPath || !challengeName) {
    console.log(`
Usage: bun run compete link <repo-path> <challenge-name> [options]

Run 'bun run compete link --help' for full documentation.
`)
    return
  }

  try {
    await linkExternalRepo({ repoPath, challengeName, testFile, type: typeFlag })
  } catch (err) {
    console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

async function printHelp() {
  const modelIds = await getModelIds()
  const modelLines: string[] = []
  for (const id of modelIds) {
    const cfg = await getModelConfig(id)
    if (cfg) modelLines.push(`  ${id.padEnd(8)} ${cfg.model} (${cfg.provider}) - requires ${cfg.envVar}`)
  }

  console.log(`
AI Code Competition Runner

Usage:
  bun run compete --challenge <name> [options]
  bun run compete init <name> [--type=function|react]
  bun run compete link <repo-path> <name> [options]

Quick Start:
  1. Set up API keys in .env (see .env.example)
  2. Run: bun run compete -c fastest-sort

Commands:
  init <name>              Create a new challenge from template
  link <repo> <name>       Connect an external repository as a challenge

Options:
  -c, --challenge <name>   Challenge to run (required for competitions)
  -m, --models <list>      Comma-separated list of models (default: sonnet,gpt4)
  -a, --attempts <n>       Max attempts per model (default: 5)
  -r, --refine             Enable refinement round after initial competition
  -l, --leaderboard        Show leaderboard for challenge
  -h, --help               Show this help

Available models (configure in compete/models.json):
${modelLines.join('\n')}

Challenge Types:
  function         Algorithm challenges with vitest benchmarks (ops/sec)
  react-component  React component challenges with Playwright perf tests (FPS)

Examples:
  bun run compete -c fastest-sort
  bun run compete -c fastest-sort -m opus -a 1
  bun run compete -c fastest-sort --refine
  bun run compete -c fastest-sort --leaderboard
  bun run compete init my-algorithm
  bun run compete link ../my-repo my-challenge

Dashboard:
  bun compete/server/index.ts   # Start web dashboard at http://localhost:3456
`)
}

main().catch(console.error)
