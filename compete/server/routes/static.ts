/**
 * Static File Handler
 *
 * Serves dashboard HTML/CSS/JS files from the static directory.
 */

import { join, extname } from 'path'

const STATIC_DIR = join(import.meta.dir, '../static')

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

/**
 * Handle static file requests
 */
export async function handleStatic(path: string): Promise<Response> {
  // Map root to index.html
  const filePath = path === '/' ? '/index.html' : path

  // Security: prevent directory traversal
  if (filePath.includes('..')) {
    return new Response('Forbidden', { status: 403 })
  }

  const fullPath = join(STATIC_DIR, filePath)
  const file = Bun.file(fullPath)

  if (!(await file.exists())) {
    return new Response('Not found', { status: 404 })
  }

  const ext = extname(filePath)
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  return new Response(file, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache', // Dev-friendly: always reload
    },
  })
}

/**
 * Check if a path should be handled as static file
 */
export function isStaticPath(pathname: string): boolean {
  // Root path or file extensions we serve
  if (pathname === '/') return true
  const ext = extname(pathname)
  return ext in MIME_TYPES
}
