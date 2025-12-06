/**
 * Playwright Performance Runner
 *
 * Measures React component performance in a real browser:
 * - FPS during interactions
 * - Render count via React Profiler
 * - Memory usage via Chrome DevTools Protocol
 */

import { chromium, Browser, Page } from 'playwright'
import type { FpsStats, RenderStats, MemoryStats, ReactPerfMetrics } from './react-metrics'
import type { PerformanceThresholds } from './challenge-config'
import { startViteServer, ViteServerInstance } from './vite-server'
import { analyzeBundle } from './bundle-analyzer'

export interface PerfTestOptions {
  /** Path to the React component file */
  componentPath: string
  /** Props to pass to the component */
  componentProps?: Record<string, unknown>
  /** Duration of performance test in ms (default: 3000) */
  testDuration?: number
  /** Warm-up duration before measuring (default: 500) */
  warmupDuration?: number
  /** Interaction script to run during test */
  interactionScript?: (page: Page) => Promise<void>
  /** Performance thresholds for pass/fail */
  thresholds?: PerformanceThresholds
  /** Enable Chrome DevTools Protocol for memory (default: true) */
  enableMemory?: boolean
}

interface RawPerfData {
  renders: Array<{
    id: string
    phase: 'mount' | 'update'
    actualDuration: number
    baseDuration: number
    startTime: number
    commitTime: number
  }>
  fps: number[]
  startTime: number
  endTime: number
}

/**
 * Run a performance test on a React component
 */
export async function runPerfTest(options: PerfTestOptions): Promise<ReactPerfMetrics> {
  const {
    componentPath,
    componentProps = {},
    testDuration = 3000,
    warmupDuration = 500,
    interactionScript,
    thresholds = {},
    enableMemory = true,
  } = options

  let browser: Browser | null = null
  let server: ViteServerInstance | null = null

  try {
    // Start Vite server
    server = await startViteServer({
      componentPath,
      componentProps,
    })

    // Launch browser with CDP enabled for memory
    // Use regular chromium (not headless shell) for stability
    browser = await chromium.launch({
      headless: true,
      channel: 'chromium',
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        ...(enableMemory ? ['--enable-precise-memory-info'] : []),
      ],
    })

    const context = await browser.newContext()
    const page = await context.newPage()

    // Navigate to the harness
    await page.goto(server.url)

    // Wait for component to be ready
    await page.waitForFunction(() => window.__READY__ === true, { timeout: 10000 })

    // Memory baseline
    let memoryStart = 0
    if (enableMemory) {
      const cdp = await context.newCDPSession(page)
      await cdp.send('Performance.enable')
      const metrics = await cdp.send('Performance.getMetrics')
      memoryStart = metrics.metrics.find(m => m.name === 'JSHeapUsedSize')?.value || 0
    }

    // Warm-up period
    await page.evaluate(() => window.__START_PERF_TEST__())
    await sleep(warmupDuration)
    await page.evaluate(() => window.__STOP_PERF_TEST__())

    // Reset and start actual test
    await page.evaluate(() => window.__START_PERF_TEST__())

    // Run interaction script if provided
    if (interactionScript) {
      await interactionScript(page)
    } else {
      // Default: scroll test
      await performDefaultInteraction(page, testDuration)
    }

    // Stop and collect data
    const perfData = await page.evaluate(() => window.__STOP_PERF_TEST__()) as RawPerfData

    // Memory end
    let memoryEnd = 0
    let memoryPeak = 0
    if (enableMemory) {
      const cdp = await context.newCDPSession(page)
      const metrics = await cdp.send('Performance.getMetrics')
      memoryEnd = metrics.metrics.find(m => m.name === 'JSHeapUsedSize')?.value || 0
      memoryPeak = memoryEnd // CDP doesn't give peak easily
    }

    // Analyze bundle size
    const bundleStats = await analyzeBundle({ entryPoint: componentPath })

    // Calculate metrics
    const fpsStats = calculateFpsStats(perfData.fps)
    const renderStats = calculateRenderStats(perfData.renders)
    const memoryStats = calculateMemoryStats(memoryStart, memoryEnd, memoryPeak)

    // Evaluate thresholds
    const fpsThreshold = thresholds.minFps || 55
    const renderThreshold = thresholds.maxAvgRenderTime || 1
    const bundleThreshold = thresholds.maxBundleSize || 5 * 1024

    const fpsPassed = fpsStats.p95 >= fpsThreshold
    const rendersPassed = renderStats.avgCommitTime <= renderThreshold
    const bundlePassed = bundleStats.gzipped <= bundleThreshold
    const memoryPassed = memoryStats.stable

    return {
      fps: fpsStats,
      renders: renderStats,
      bundle: bundleStats,
      memory: enableMemory ? memoryStats : undefined,
      passed: fpsPassed && rendersPassed && bundlePassed,
      thresholds: {
        fps: { passed: fpsPassed, target: fpsThreshold, actual: fpsStats.p95 },
        renders: { passed: rendersPassed, target: renderThreshold, actual: renderStats.avgCommitTime },
        bundle: { passed: bundlePassed, target: bundleThreshold, actual: bundleStats.gzipped },
        memory: enableMemory
          ? { passed: memoryPassed, target: thresholds.maxMemoryGrowth || 1024 * 1024, actual: memoryStats.growth }
          : undefined,
      },
    }
  } finally {
    if (browser) await browser.close()
    if (server) await server.stop()
  }
}

/**
 * Default interaction: scroll through a container
 */
async function performDefaultInteraction(page: Page, duration: number): Promise<void> {
  const startTime = Date.now()
  const endTime = startTime + duration

  while (Date.now() < endTime) {
    // Scroll down
    await page.mouse.wheel(0, 200)
    await sleep(16) // ~60fps frame timing

    // Scroll up occasionally for realistic behavior
    if (Math.random() > 0.7) {
      await page.mouse.wheel(0, -100)
      await sleep(16)
    }
  }
}

function calculateFpsStats(fpsData: number[]): FpsStats {
  if (fpsData.length === 0) {
    return { min: 0, max: 0, avg: 0, p95: 0, frameCount: 0, duration: 0 }
  }

  // Filter outliers (very high/low values from timing jitter)
  const filtered = fpsData.filter(fps => fps > 10 && fps < 200)
  if (filtered.length === 0) {
    return { min: 0, max: 0, avg: 0, p95: 0, frameCount: fpsData.length, duration: 0 }
  }

  const sorted = [...filtered].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const avg = filtered.reduce((sum, fps) => sum + fps, 0) / filtered.length
  const p95Index = Math.floor(sorted.length * 0.05) // 95th percentile = 5% from bottom
  const p95 = sorted[p95Index]

  return {
    min,
    max,
    avg,
    p95,
    frameCount: fpsData.length,
    duration: fpsData.length * 16.67, // Approximate duration
  }
}

function calculateRenderStats(renders: RawPerfData['renders']): RenderStats {
  if (renders.length === 0) {
    return { renderCount: 0, totalCommitTime: 0, avgCommitTime: 0 }
  }

  const totalCommitTime = renders.reduce((sum, r) => sum + r.actualDuration, 0)
  const avgCommitTime = totalCommitTime / renders.length

  // Count by component
  const componentRenders: Record<string, number> = {}
  for (const render of renders) {
    componentRenders[render.id] = (componentRenders[render.id] || 0) + 1
  }

  return {
    renderCount: renders.length,
    totalCommitTime,
    avgCommitTime,
    componentRenders,
  }
}

function calculateMemoryStats(start: number, end: number, peak: number): MemoryStats {
  const growth = end - start
  // Consider stable if growth is < 1MB
  const stable = growth < 1024 * 1024

  return {
    heapStart: start,
    heapEnd: end,
    heapPeak: peak,
    growth,
    stable,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
