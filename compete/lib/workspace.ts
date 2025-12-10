/**
 * Isolated Test Workspace Manager
 *
 * Creates temporary workspaces for external repo competitions to avoid
 * polluting the external repository with AI-generated solution files.
 *
 * Workspace structure:
 *   compete/.tmp/{challengeName}-{timestamp}/
 *   ├── {solutionDir}/solution.ts(x)   - AI-generated solution
 *   ├── {testDir}/spec.test.ts(x)      - Copied test files
 *   ├── {copyPaths...}                 - Additional dependencies (via copyPaths)
 *   ├── node_modules -> symlink        - From external repo
 *   ├── vitest.config.ts               - Copied from challenge
 *   └── tsconfig.json                  - Copied from external repo
 *
 * The copyPaths option allows specifying additional files or directories
 * from the external repo that should be copied into the workspace (e.g.,
 * utility modules, type definitions, or shared dependencies).
 */

import { mkdir, cp, symlink, rm, copyFile, readdir, stat, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname, basename } from 'path'
import type { ExternalRepoConfig } from './challenge-config'

const TMP_DIR = join(process.cwd(), 'compete/.tmp')

export interface WorkspaceContext {
  /** Path to the isolated workspace root */
  workspacePath: string
  /** Path where the AI solution should be written */
  solutionPath: string
  /** Path to the test file in the workspace */
  testPath: string
  /** Cleanup function to remove the workspace */
  cleanup: () => Promise<void>
}

export interface SetupWorkspaceOptions {
  /** Challenge name (for directory naming) */
  challengeName: string
  /** Path to the challenge directory in compete/challenges/ */
  challengePath: string
  /** External repo configuration */
  externalRepo: ExternalRepoConfig
  /** File extension for solution (ts or tsx) */
  fileExt: 'ts' | 'tsx'
  /** Keep workspace after cleanup for debugging */
  keepWorkspace?: boolean
}

/**
 * Set up an isolated workspace for external repo testing
 */
export async function setupExternalWorkspace(
  options: SetupWorkspaceOptions
): Promise<WorkspaceContext> {
  const { challengeName, challengePath, externalRepo, fileExt, keepWorkspace } = options
  const timestamp = Date.now()
  const workspacePath = join(TMP_DIR, `${challengeName}-${timestamp}`)

  // Ensure tmp directory exists
  await mkdir(TMP_DIR, { recursive: true })
  await mkdir(workspacePath, { recursive: true })

  const externalRepoPath = externalRepo.path.startsWith('/')
    ? externalRepo.path
    : join(process.cwd(), externalRepo.path)

  // 1. Create solution directory structure
  const solutionDir = dirname(externalRepo.solutionPath)
  if (solutionDir && solutionDir !== '.') {
    await mkdir(join(workspacePath, solutionDir), { recursive: true })
  }
  const solutionPath = join(workspacePath, externalRepo.solutionPath)

  // 2. Copy test file and its directory (for relative imports like ./fixtures)
  const testDir = dirname(externalRepo.testPath)
  const testFileName = basename(externalRepo.testPath)
  const sourceTestDir = join(externalRepoPath, testDir)
  const destTestDir = join(workspacePath, testDir)

  if (testDir && testDir !== '.') {
    await mkdir(destTestDir, { recursive: true })
  }

  // Copy entire test directory to preserve fixtures and relative imports
  if (existsSync(sourceTestDir)) {
    await copyDirectoryContents(sourceTestDir, destTestDir)
  }
  const testPath = join(workspacePath, externalRepo.testPath)

  // 2.5 Copy additional dependency paths specified in copyPaths
  if (externalRepo.copyPaths && externalRepo.copyPaths.length > 0) {
    for (const copyPath of externalRepo.copyPaths) {
      const sourcePath = join(externalRepoPath, copyPath)
      const destPath = join(workspacePath, copyPath)

      if (!existsSync(sourcePath)) {
        console.warn(`  [Workspace] Warning: copyPath not found: ${copyPath}`)
        continue
      }

      const sourceStat = await stat(sourcePath)

      if (sourceStat.isDirectory()) {
        // Copy entire directory
        await mkdir(dirname(destPath), { recursive: true })
        await copyDirectoryContents(sourcePath, destPath)
      } else {
        // Copy single file
        await mkdir(dirname(destPath), { recursive: true })
        await copyFile(sourcePath, destPath)
      }
    }
  }

  // 3. Copy vitest config from challenge directory
  const challengeVitestConfig = join(challengePath, 'vitest.config.ts')
  if (existsSync(challengeVitestConfig)) {
    await copyFile(challengeVitestConfig, join(workspacePath, 'vitest.config.ts'))
  } else {
    // Create a minimal vitest config
    await writeFile(
      join(workspacePath, 'vitest.config.ts'),
      `import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
})
`
    )
  }

  // 4. Symlink node_modules from external repo
  const externalNodeModules = join(externalRepoPath, 'node_modules')
  const workspaceNodeModules = join(workspacePath, 'node_modules')
  if (existsSync(externalNodeModules)) {
    await symlink(externalNodeModules, workspaceNodeModules, 'dir')
  }

  // 5. Copy tsconfig for path aliases
  const externalTsconfig = join(externalRepoPath, 'tsconfig.json')
  if (existsSync(externalTsconfig)) {
    await copyFile(externalTsconfig, join(workspacePath, 'tsconfig.json'))
  }

  // 6. Copy package.json for module resolution
  const externalPackageJson = join(externalRepoPath, 'package.json')
  if (existsSync(externalPackageJson)) {
    await copyFile(externalPackageJson, join(workspacePath, 'package.json'))
  }

  const cleanup = async () => {
    if (keepWorkspace) {
      console.log(`  [Workspace kept for debugging: ${workspacePath}]`)
      return
    }
    try {
      await rm(workspacePath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }

  return {
    workspacePath,
    solutionPath,
    testPath,
    cleanup,
  }
}

/**
 * Copy directory contents recursively (without copying node_modules)
 */
async function copyDirectoryContents(src: string, dest: string): Promise<void> {
  if (!existsSync(dest)) {
    await mkdir(dest, { recursive: true })
  }

  const entries = await readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    // Skip node_modules, .git, and other large directories
    if (['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
      continue
    }

    if (entry.isDirectory()) {
      await copyDirectoryContents(srcPath, destPath)
    } else {
      await copyFile(srcPath, destPath)
    }
  }
}

/**
 * Clean up old workspaces (older than 1 hour)
 */
export async function cleanupOldWorkspaces(): Promise<void> {
  if (!existsSync(TMP_DIR)) return

  const oneHourAgo = Date.now() - 60 * 60 * 1000

  try {
    const entries = await readdir(TMP_DIR, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const dirPath = join(TMP_DIR, entry.name)
      const dirStat = await stat(dirPath)

      if (dirStat.mtimeMs < oneHourAgo) {
        try {
          await rm(dirPath, { recursive: true, force: true })
          console.log(`  [Cleaned up old workspace: ${entry.name}]`)
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  } catch {
    // Ignore errors listing tmp directory
  }
}

/**
 * Check if a challenge uses an external repo
 */
export function isExternalRepoChallenge(
  config: { externalRepo?: ExternalRepoConfig }
): boolean {
  return Boolean(config.externalRepo?.path && config.externalRepo?.solutionPath)
}
