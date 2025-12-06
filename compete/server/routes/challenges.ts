/**
 * Challenges Route Handlers
 *
 * GET  /api/challenges       - List available challenges
 * POST /api/challenges       - Create an ad-hoc challenge
 * GET  /api/challenges/:name - Get challenge details
 */

import { readdir, readFile, writeFile, mkdir, stat } from 'fs/promises'
import { join } from 'path'
import type { ChallengeInfo, ChallengeDetailResponse, CreateChallengeRequest } from '../types'
import { loadChallengeConfig } from '../../lib/challenge-config'
import { getExternalChallenges, registerExternal, resolveChallengePath } from '../registry'

const CHALLENGES_DIR = join(process.cwd(), 'compete/challenges')
const ADHOC_DIR = join(CHALLENGES_DIR, '.adhoc')
const RESULTS_DIR = join(process.cwd(), 'compete/results')

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
 * GET /api/challenges - List all challenges
 */
export async function handleChallenges(): Promise<Response> {
  try {
    const entries = await readdir(CHALLENGES_DIR, { withFileTypes: true })
    const challenges: ChallengeInfo[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('.')) continue // Skip .adhoc

      const challengePath = join(CHALLENGES_DIR, entry.name)

      try {
        const config = await loadChallengeConfig(challengePath)

        // Check for results
        let hasResults = false
        try {
          await stat(join(RESULTS_DIR, `${entry.name}.json`))
          hasResults = true
        } catch {
          // No results file
        }

        challenges.push({
          name: entry.name,
          type: config.type,
          path: challengePath,
          hasResults,
        })
      } catch {
        // Skip invalid challenges
      }
    }

    // Also include ad-hoc challenges
    try {
      const adhocEntries = await readdir(ADHOC_DIR, { withFileTypes: true })
      for (const entry of adhocEntries) {
        if (!entry.isDirectory()) continue

        const challengePath = join(ADHOC_DIR, entry.name)
        try {
          const config = await loadChallengeConfig(challengePath)
          challenges.push({
            name: entry.name,
            type: config.type,
            path: challengePath,
            hasResults: false,
          })
        } catch {
          // Skip invalid
        }
      }
    } catch {
      // No adhoc dir yet
    }

    // Include external repository challenges
    try {
      const externalChallenges = await getExternalChallenges()
      for (const { name, path: challengePath } of externalChallenges) {
        try {
          const config = await loadChallengeConfig(challengePath)

          // Check for results
          let hasResults = false
          try {
            await stat(join(RESULTS_DIR, `${name}.json`))
            hasResults = true
          } catch {
            // No results file
          }

          challenges.push({
            name,
            type: config.type,
            path: challengePath,
            hasResults,
            isExternal: true,
          })
        } catch {
          // Skip invalid external challenges
        }
      }
    } catch {
      // Registry read failed
    }

    return json({ challenges })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: message }, 500)
  }
}

/**
 * GET /api/challenges/:name - Get challenge details
 */
export async function handleChallengeDetail(name: string): Promise<Response> {
  try {
    // Use registry to resolve path (handles external, adhoc, and local challenges)
    const challengePath = await resolveChallengePath(name)

    // Verify the path exists
    await stat(challengePath)

    const config = await loadChallengeConfig(challengePath)

    // Read prompt
    let prompt = ''
    try {
      prompt = await readFile(join(challengePath, 'prompt.md'), 'utf-8')
    } catch {
      // No prompt file
    }

    // Read results
    let latestResults = undefined
    try {
      const resultsPath = join(RESULTS_DIR, `${name}.json`)
      const resultsData = await readFile(resultsPath, 'utf-8')
      const results = JSON.parse(resultsData)
      latestResults = results.history?.[0]
    } catch {
      // No results
    }

    const response: ChallengeDetailResponse = {
      name,
      type: config.type,
      path: challengePath,
      hasResults: !!latestResults,
      config: {
        type: config.type,
        performanceThresholds: config.performanceThresholds,
      },
      prompt,
      latestResults,
    }

    return json(response)
  } catch (err) {
    return json({ error: `Challenge '${name}' not found` }, 404)
  }
}

/**
 * POST /api/challenges - Create an ad-hoc challenge
 */
export async function handleCreateChallenge(body: unknown): Promise<Response> {
  const req = body as CreateChallengeRequest

  if (!req.name) {
    return json({ error: 'name is required' }, 400)
  }

  // Validate name (alphanumeric + hyphens only)
  if (!/^[a-z0-9-]+$/.test(req.name)) {
    return json({ error: 'Invalid challenge name. Use lowercase letters, numbers, and hyphens only.' }, 400)
  }

  if (!req.type) {
    return json({ error: 'type is required (function or react-component)' }, 400)
  }

  if (!req.prompt) {
    return json({ error: 'prompt is required' }, 400)
  }

  if (!req.testCode && !req.externalRepo) {
    return json({ error: 'testCode or externalRepo is required' }, 400)
  }

  try {
    let challengePath: string

    if (req.externalRepo) {
      // Use external repo directly
      challengePath = req.externalRepo.path

      // Create challenge config in external repo
      const config = {
        type: req.type,
        externalRepo: {
          testPath: req.externalRepo.testPath,
          solutionPath: req.externalRepo.solutionPath,
        },
        performanceThresholds: req.perfConfig?.thresholds,
      }

      await writeFile(
        join(challengePath, 'challenge.config.json'),
        JSON.stringify(config, null, 2)
      )

      // Write prompt
      await writeFile(join(challengePath, 'prompt.md'), req.prompt)

      // Register in external challenge registry
      await registerExternal(req.name, challengePath)
    } else {
      // Create in adhoc directory
      challengePath = join(ADHOC_DIR, req.name)
      await mkdir(challengePath, { recursive: true })

      // Write challenge config
      const config = {
        type: req.type,
        performanceThresholds: req.perfConfig?.thresholds,
      }
      await writeFile(
        join(challengePath, 'challenge.config.json'),
        JSON.stringify(config, null, 2)
      )

      // Write prompt
      await writeFile(join(challengePath, 'prompt.md'), req.prompt)

      // Write test file
      const testExt = req.type === 'react-component' ? 'tsx' : 'ts'
      await writeFile(join(challengePath, `spec.test.${testExt}`), req.testCode!)

      // Write bench file if provided
      if (req.benchCode) {
        await writeFile(join(challengePath, 'spec.bench.ts'), req.benchCode)
      }
    }

    return json({
      challenge: req.name,
      path: challengePath,
      type: req.type,
    }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: message }, 500)
  }
}
