#!/usr/bin/env bun
/**
 * eval-loop HTTP API Server
 *
 * Exposes the AI code competition harness as a REST API.
 *
 * Usage:
 *   bun run server                    # Start on default port 3456
 *   PORT=8080 bun run server          # Start on custom port
 */

import { handleCompete } from './routes/compete'
import { handleValidate } from './routes/validate'
import { handleGenerate } from './routes/generate'
import { handleChallenges, handleChallengeDetail, handleCreateChallenge } from './routes/challenges'
import { handleResults } from './routes/results'
import { handleJobStatus, handleCancelJob, handleListJobs, handleJobDebug } from './routes/jobs'
import { handleDocs } from './routes/docs'
import { handleStatic, isStaticPath } from './routes/static'
import { jobManager } from './jobs/manager'
import { openApiSchema } from './schema'
import { spawnSync } from 'child_process'

const PORT = parseInt(process.env.PORT || '3456', 10)
const START_TIME = Date.now()

// Get git commit hash at startup (using spawnSync to avoid shell injection)
const GIT_COMMIT = (() => {
  try {
    const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf-8' })
    return result.stdout?.trim() || 'unknown'
  } catch {
    return 'unknown'
  }
})()

/**
 * CORS headers for cross-origin requests
 */
function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

/**
 * Parse JSON body from request
 */
async function parseBody<T>(req: Request): Promise<T> {
  try {
    return await req.json()
  } catch {
    throw new Error('Invalid JSON body')
  }
}

/**
 * JSON response helper
 */
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
 * Error response helper
 */
function error(message: string, status = 400): Response {
  return json({ error: message }, status)
}

/**
 * Main request handler
 */
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const { pathname } = url
  const method = req.method

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    })
  }

  try {
    // Health check
    if (pathname === '/api/health' && method === 'GET') {
      const stats = jobManager.getStats()
      return json({
        status: 'ok',
        version: '1.0.0',
        commit: GIT_COMMIT,
        uptime: Date.now() - START_TIME,
        activeJobs: stats.runningJobs + stats.queuedJobs,
      })
    }

    // OpenAPI schema (for AI agents and tooling)
    if (pathname === '/api/schema' && method === 'GET') {
      return json(openApiSchema)
    }

    // Swagger UI documentation
    if (pathname === '/api/docs' && method === 'GET') {
      const baseUrl = `http://localhost:${PORT}`
      return handleDocs(baseUrl)
    }

    // Competition API
    if (pathname === '/api/compete' && method === 'POST') {
      const body = await parseBody(req)
      return await handleCompete(body)
    }

    // Validation API
    if (pathname === '/api/validate' && method === 'POST') {
      const body = await parseBody(req)
      return handleValidate(body)
    }

    // Generate API
    if (pathname === '/api/generate' && method === 'POST') {
      const body = await parseBody(req)
      return handleGenerate(body)
    }

    // Challenge list
    if (pathname === '/api/challenges' && method === 'GET') {
      return handleChallenges()
    }

    // Create challenge
    if (pathname === '/api/challenges' && method === 'POST') {
      const body = await parseBody(req)
      return handleCreateChallenge(body)
    }

    // Challenge detail
    const challengeMatch = pathname.match(/^\/api\/challenges\/([^/]+)$/)
    if (challengeMatch && method === 'GET') {
      return handleChallengeDetail(challengeMatch[1])
    }

    // Historical results
    if (pathname === '/api/results' && method === 'GET') {
      return handleResults(url)
    }

    // List all jobs
    if (pathname === '/api/jobs' && method === 'GET') {
      return handleListJobs()
    }

    // Job debug (must match before simpler job status route)
    const jobDebugMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/debug$/)
    if (jobDebugMatch && method === 'GET') {
      const modelFilter = url.searchParams.get('model') || undefined
      return await handleJobDebug(jobDebugMatch[1], modelFilter)
    }

    // Job status
    const jobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/)
    if (jobMatch && method === 'GET') {
      return handleJobStatus(jobMatch[1])
    }

    // Cancel job
    if (jobMatch && method === 'DELETE') {
      return handleCancelJob(jobMatch[1])
    }

    // Static files (dashboard)
    if ((method === 'GET' || method === 'HEAD') && isStaticPath(pathname)) {
      return handleStatic(pathname)
    }

    // 404
    return error('Not found', 404)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Request error:', message)
    return error(message, 500)
  }
}

// Start server
const server = Bun.serve({
  port: PORT,
  fetch: handleRequest,
})

console.log(`
╔═══════════════════════════════════════════════════╗
║           eval-loop API Server                    ║
╠═══════════════════════════════════════════════════╣
║                                                   ║
║   Dashboard: http://localhost:${PORT}               ║
║                                                   ║
║   API Endpoints:                                  ║
║   POST /api/compete     - Run competition (SSE)   ║
║   POST /api/validate    - Test your code          ║
║   POST /api/generate    - Generate code           ║
║   GET  /api/challenges  - List challenges         ║
║   POST /api/challenges  - Create ad-hoc challenge ║
║   GET  /api/jobs        - List all jobs           ║
║   GET  /api/jobs/:id    - Poll job status         ║
║   GET  /api/health      - Health check            ║
║   GET  /api/schema      - OpenAPI spec (AI/tools) ║
║   GET  /api/docs        - Swagger UI              ║
║                                                   ║
║   Press Ctrl+C to stop                            ║
╚═══════════════════════════════════════════════════╝
`)

export { server }
