/**
 * External Repository Linker
 *
 * Helps users connect external repositories to the compete system
 * by scanning for test files and generating configuration.
 */

import { mkdir, writeFile, readFile, readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname, basename, relative, resolve } from 'path'
import type { ChallengeType, ExternalRepoConfig } from './challenge-config'

interface LinkOptions {
  /** Path to the external repository */
  repoPath: string
  /** Name for the challenge */
  challengeName: string
  /** Specific test file to use (optional, will scan if not provided) */
  testFile?: string
  /** Challenge type */
  type?: ChallengeType
}

interface DiscoveredTest {
  path: string
  type: ChallengeType
}

interface LinkResult {
  challengePath: string
  config: ExternalRepoConfig
  type: ChallengeType
}

/**
 * Scan a repository for test files
 */
async function discoverTestFiles(repoPath: string): Promise<DiscoveredTest[]> {
  const tests: DiscoveredTest[] = []
  const seenPaths = new Set<string>()
  const searchDirs = ['__tests__', 'tests', 'test', 'spec', 'src', '.']

  for (const dir of searchDirs) {
    const searchPath = join(repoPath, dir)
    if (!existsSync(searchPath)) continue

    try {
      await scanDirectory(searchPath, repoPath, tests, seenPaths)
    } catch {
      // Skip directories we can't read
    }
  }

  return tests
}

async function scanDirectory(
  dirPath: string,
  repoPath: string,
  tests: DiscoveredTest[],
  seenPaths: Set<string>,
  depth = 0
): Promise<void> {
  if (depth > 4) return // Limit recursion depth

  const entries = await readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)

    // Skip common non-test directories
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
        continue
      }
      await scanDirectory(fullPath, repoPath, tests, seenPaths, depth + 1)
      continue
    }

    // Check for test file patterns
    if (entry.isFile()) {
      const name = entry.name
      const isTest =
        name.endsWith('.test.ts') ||
        name.endsWith('.test.tsx') ||
        name.endsWith('.spec.ts') ||
        name.endsWith('.spec.tsx') ||
        name.endsWith('_test.ts') ||
        name.endsWith('_test.tsx')

      if (isTest) {
        const relativePath = relative(repoPath, fullPath)
        // Skip if we've already seen this file
        if (seenPaths.has(relativePath)) continue
        seenPaths.add(relativePath)
        const type: ChallengeType = name.endsWith('.tsx') ? 'react-component' : 'function'
        tests.push({ path: relativePath, type })
      }
    }
  }
}

/**
 * Suggest a solution path based on test file location
 */
function suggestSolutionPath(testPath: string): string {
  const dir = dirname(testPath)
  const ext = testPath.endsWith('.tsx') ? '.tsx' : '.ts'

  // If test is in __tests__ or tests directory, solution should be next to it
  if (dir.includes('__tests__') || dir.includes('/tests/') || dir.includes('/test/')) {
    return join(dir, `solution${ext}`)
  }

  // Otherwise put solution in same directory
  return join(dir, `solution${ext}`)
}

/**
 * Scan imports in a test file to suggest copyPaths
 */
async function suggestCopyPaths(repoPath: string, testPath: string): Promise<string[]> {
  const copyPaths: string[] = []
  const testFullPath = join(repoPath, testPath)

  try {
    const content = await readFile(testFullPath, 'utf-8')

    // Find relative imports
    const importRegex = /from\s+['"](\.[^'"]+)['"]/g
    let match

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]

      // Skip the solution import (that's what we're generating)
      if (importPath.includes('solution')) continue

      // Resolve the import relative to the test file
      const testDir = dirname(testFullPath)
      let resolvedPath = resolve(testDir, importPath)

      // Try with extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '']
      for (const ext of extensions) {
        const pathWithExt = resolvedPath + ext
        if (existsSync(pathWithExt)) {
          const relativeToCwd = relative(repoPath, pathWithExt)
          if (!copyPaths.includes(relativeToCwd)) {
            copyPaths.push(relativeToCwd)
          }
          break
        }

        // Check for index file
        const indexPath = join(resolvedPath, `index${ext || '.ts'}`)
        if (existsSync(indexPath)) {
          const relativeToCwd = relative(repoPath, resolvedPath)
          if (!copyPaths.includes(relativeToCwd)) {
            copyPaths.push(relativeToCwd)
          }
          break
        }
      }
    }

    // Also check for fixtures directories
    const testDir = dirname(testFullPath)
    const fixturesDir = join(testDir, 'fixtures')
    if (existsSync(fixturesDir)) {
      const relativeFixtures = relative(repoPath, fixturesDir)
      if (!copyPaths.includes(relativeFixtures)) {
        copyPaths.push(relativeFixtures)
      }
    }
  } catch {
    // Ignore errors reading test file
  }

  return copyPaths
}

/**
 * Create a prompt template for an external repo challenge
 */
function createExternalPrompt(challengeName: string, type: ChallengeType): string {
  const displayName = challengeName
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  if (type === 'react-component') {
    return `# Challenge: ${displayName}

Write a React component that passes all the tests in the external repository.

## Requirements

Review the test file to understand the expected behavior.

## Scoring

Solutions are ranked by:
1. Correctness (must pass all tests)
2. Performance (FPS, render count)

## Previous Feedback

{{feedback}}
`
  }

  return `# Challenge: ${displayName}

Write a TypeScript function that passes all the tests in the external repository.

## Requirements

Review the test file to understand the expected behavior.

## Scoring

Solutions are ranked by:
1. Correctness (must pass all tests)
2. Performance (operations per second)

## Previous Feedback

{{feedback}}
`
}

/**
 * Link an external repository to the compete system
 */
export async function linkExternalRepo(options: LinkOptions): Promise<LinkResult> {
  const { repoPath, challengeName, testFile, type: specifiedType } = options

  // Resolve to absolute path
  const absoluteRepoPath = repoPath.startsWith('/')
    ? repoPath
    : resolve(process.cwd(), repoPath)

  // Validate repo exists
  if (!existsSync(absoluteRepoPath)) {
    throw new Error(`Repository not found: ${absoluteRepoPath}`)
  }

  // Find or validate test file
  let selectedTest: DiscoveredTest

  if (testFile) {
    const testPath = join(absoluteRepoPath, testFile)
    if (!existsSync(testPath)) {
      throw new Error(`Test file not found: ${testFile}`)
    }
    const type: ChallengeType = testFile.endsWith('.tsx') ? 'react-component' : 'function'
    selectedTest = { path: testFile, type: specifiedType || type }
  } else {
    // Discover test files
    const tests = await discoverTestFiles(absoluteRepoPath)

    if (tests.length === 0) {
      throw new Error(
        `No test files found in ${absoluteRepoPath}\n` +
          'Looking for: *.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx\n' +
          'Use --test <path> to specify a test file manually.'
      )
    }

    // If multiple tests, list them
    if (tests.length > 1) {
      console.log('\nFound multiple test files:')
      tests.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.path} (${t.type})`)
      })
      console.log('\nUsing first test file. Use --test <path> to specify a different one.')
    }

    selectedTest = tests[0]
    if (specifiedType) {
      selectedTest.type = specifiedType
    }
  }

  // Suggest solution path
  const solutionPath = suggestSolutionPath(selectedTest.path)

  // Suggest copyPaths
  const copyPaths = await suggestCopyPaths(absoluteRepoPath, selectedTest.path)

  // Create challenge directory
  const challengePath = join(process.cwd(), 'compete/challenges', challengeName)
  if (existsSync(challengePath)) {
    throw new Error(`Challenge '${challengeName}' already exists`)
  }
  await mkdir(challengePath, { recursive: true })

  // Build external repo config
  const externalConfig: ExternalRepoConfig = {
    path: absoluteRepoPath,
    testPath: selectedTest.path,
    solutionPath,
  }

  if (copyPaths.length > 0) {
    externalConfig.copyPaths = copyPaths
  }

  // Create challenge.config.json
  const challengeConfig = {
    type: selectedTest.type,
    name: challengeName,
    externalRepo: externalConfig,
    generationTimeout: selectedTest.type === 'react-component' ? 90000 : 60000,
    maxRetries: 3,
  }

  await writeFile(
    join(challengePath, 'challenge.config.json'),
    JSON.stringify(challengeConfig, null, 2)
  )

  // Create prompt.md
  await writeFile(
    join(challengePath, 'prompt.md'),
    createExternalPrompt(challengeName, selectedTest.type)
  )

  // Print results
  console.log(`\nLinked external repository to challenge '${challengeName}'`)
  console.log(`\nConfiguration:`)
  console.log(`  Repository: ${absoluteRepoPath}`)
  console.log(`  Test file:  ${selectedTest.path}`)
  console.log(`  Solution:   ${solutionPath}`)
  if (copyPaths.length > 0) {
    console.log(`  Dependencies: ${copyPaths.join(', ')}`)
  }
  console.log(`  Type:       ${selectedTest.type}`)

  console.log(`\nFiles created:`)
  console.log(`  - ${challengePath}/challenge.config.json`)
  console.log(`  - ${challengePath}/prompt.md`)

  console.log(`\nNext steps:`)
  console.log(`  1. Review challenge.config.json and adjust paths if needed`)
  console.log(`  2. Edit prompt.md to describe the challenge for AI models`)
  console.log(`  3. Run: bun run compete -c ${challengeName}`)

  if (copyPaths.length === 0) {
    console.log(`\nNote: No dependencies were auto-detected.`)
    console.log(`If tests fail due to missing imports, add paths to "copyPaths" in challenge.config.json`)
  }

  return {
    challengePath,
    config: externalConfig,
    type: selectedTest.type,
  }
}

/**
 * Show help for the link command
 */
export function showLinkHelp(): void {
  console.log(`
Usage: bun run compete link <repo-path> <challenge-name> [options]

Connect an external repository to the compete system.

Arguments:
  <repo-path>         Path to the external repository
  <challenge-name>    Name for the new challenge

Options:
  --test <path>       Specific test file to use (relative to repo)
  --type <type>       Challenge type: function or react-component

Examples:
  bun run compete link ../my-project my-challenge
  bun run compete link /path/to/repo sorting-algo --test src/__tests__/sort.test.ts
  bun run compete link ~/projects/app my-component --type react-component

What this does:
  1. Scans the repository for test files (*.test.ts, *.spec.ts, etc.)
  2. Creates a challenge configuration linking to the external tests
  3. Auto-detects dependencies that need to be copied for tests to run

The external repository is NOT modified. Tests run in an isolated workspace.
`)
}
