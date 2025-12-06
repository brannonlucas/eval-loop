/**
 * Vite Server Manager
 *
 * Manages Vite dev server lifecycle for React component performance testing.
 * Creates a harness that imports the component under test.
 */

import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFile, rm, mkdir } from 'fs/promises'
import { join, dirname, resolve, relative } from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface ViteServerOptions {
  /** Path to the React component file */
  componentPath: string
  /** Props to pass to the component (as JSON-serializable object) */
  componentProps?: Record<string, unknown>
  /** Custom port (default: auto-assigned) */
  port?: number
}

export interface ViteServerInstance {
  /** Server URL (e.g., http://localhost:5173) */
  url: string
  /** Port number */
  port: number
  /** Stop the server and clean up */
  stop: () => Promise<void>
}

/**
 * Start a Vite dev server with the component under test
 */
export async function startViteServer(options: ViteServerOptions): Promise<ViteServerInstance> {
  const { componentPath, componentProps = {}, port } = options

  const absComponentPath = resolve(componentPath)
  if (!existsSync(absComponentPath)) {
    throw new Error(`Component file not found: ${absComponentPath}`)
  }

  // Use project root for Vite so transforms work correctly
  const projectRoot = resolve(__dirname, '../..')

  // Create harness directory within project
  const harnessDir = join(projectRoot, '.harness')
  await mkdir(harnessDir, { recursive: true })

  // Calculate relative import path from harness to component
  const relativeComponentPath = relative(harnessDir, absComponentPath)
    .replace(/\\/g, '/') // Windows compatibility
    .replace(/\.tsx$/, '')
    .replace(/\.jsx$/, '')

  // Create index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>React Component Performance Test</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #root { width: 100vw; height: 100vh; overflow: hidden; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>`

  await writeFile(join(harnessDir, 'index.html'), indexHtml)

  // Create main.tsx with the component harness
  const mainTsx = `
import React, { Profiler } from 'react'
import { createRoot } from 'react-dom/client'
import Component from '${relativeComponentPath}'

const componentProps = ${JSON.stringify(componentProps)}

declare global {
  interface Window {
    __PERF_DATA__: { renders: unknown[]; fps: number[]; startTime: number; endTime: number }
    __READY__: boolean
    __START_PERF_TEST__: () => void
    __STOP_PERF_TEST__: () => unknown
  }
}

window.__PERF_DATA__ = {
  renders: [],
  fps: [],
  startTime: 0,
  endTime: 0,
}

let fpsFrameId: number | null = null
let lastFrameTime = 0

function startFpsMonitoring() {
  lastFrameTime = performance.now()
  function measureFrame(currentTime: number) {
    const delta = currentTime - lastFrameTime
    if (delta > 0) {
      const fps = 1000 / delta
      window.__PERF_DATA__.fps.push(fps)
    }
    lastFrameTime = currentTime
    fpsFrameId = requestAnimationFrame(measureFrame)
  }
  fpsFrameId = requestAnimationFrame(measureFrame)
}

function stopFpsMonitoring() {
  if (fpsFrameId !== null) {
    cancelAnimationFrame(fpsFrameId)
    fpsFrameId = null
  }
}

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  window.__PERF_DATA__.renders.push({
    id, phase, actualDuration, baseDuration, startTime, commitTime,
  })
}

window.__START_PERF_TEST__ = () => {
  window.__PERF_DATA__ = { renders: [], fps: [], startTime: performance.now(), endTime: 0 }
  startFpsMonitoring()
}

window.__STOP_PERF_TEST__ = () => {
  stopFpsMonitoring()
  window.__PERF_DATA__.endTime = performance.now()
  return window.__PERF_DATA__
}

function TestHarness() {
  return (
    <Profiler id="component-under-test" onRender={onRenderCallback}>
      <Component {...componentProps} />
    </Profiler>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<TestHarness />)

window.__READY__ = true
`

  await writeFile(join(harnessDir, 'main.tsx'), mainTsx)

  // Create Vite server from project root so it has access to configs
  const server = await createServer({
    root: harnessDir,
    configFile: false,
    plugins: [react()],
    server: {
      port: port ?? 0, // 0 = auto-assign
      strictPort: false,
      fs: {
        // Allow serving files from harness and component directories
        allow: [projectRoot],
      },
    },
    logLevel: 'silent',
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
  })

  await server.listen()
  const resolvedPort = server.config.server.port!
  const url = `http://localhost:${resolvedPort}`

  return {
    url,
    port: resolvedPort,
    stop: async () => {
      await server.close()
      await rm(harnessDir, { recursive: true, force: true })
    },
  }
}

/**
 * Simple wrapper for running a perf test with automatic cleanup
 */
export async function withViteServer<T>(
  options: ViteServerOptions,
  callback: (server: ViteServerInstance) => Promise<T>
): Promise<T> {
  const server = await startViteServer(options)
  try {
    return await callback(server)
  } finally {
    await server.stop()
  }
}
