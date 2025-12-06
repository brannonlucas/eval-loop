/**
 * React Performance Metrics
 *
 * Type definitions for measuring React component performance
 * in real browser environments via Playwright.
 */

/**
 * FPS (Frames Per Second) statistics collected during interaction
 */
export interface FpsStats {
  /** Minimum FPS observed */
  min: number
  /** Maximum FPS observed */
  max: number
  /** Average FPS across all frames */
  avg: number
  /** 95th percentile FPS (key smoothness metric) */
  p95: number
  /** Total frames measured */
  frameCount: number
  /** Duration of measurement in ms */
  duration: number
}

/**
 * React render statistics from React Profiler
 */
export interface RenderStats {
  /** Total number of renders during test */
  renderCount: number
  /** Total time spent in React commit phase (ms) */
  totalCommitTime: number
  /** Average commit time per render (ms) */
  avgCommitTime: number
  /** Components that rendered (for debugging) */
  componentRenders?: Record<string, number>
}

/**
 * Bundle size analysis
 */
export interface BundleStats {
  /** Raw bundle size in bytes (before compression) */
  raw: number
  /** Gzipped bundle size in bytes */
  gzipped: number
  /** Individual chunk sizes if code-split */
  chunks?: Array<{ name: string; size: number }>
}

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  /** JS heap size at start (bytes) */
  heapStart: number
  /** JS heap size at end (bytes) */
  heapEnd: number
  /** Peak heap size during test (bytes) */
  heapPeak: number
  /** Memory growth (heapEnd - heapStart) */
  growth: number
  /** Whether memory is stable (no significant growth) */
  stable: boolean
}

/**
 * Complete React performance metrics
 */
export interface ReactPerfMetrics {
  /** FPS statistics during interaction */
  fps: FpsStats
  /** React render statistics */
  renders: RenderStats
  /** Bundle size analysis */
  bundle: BundleStats
  /** Memory usage (optional, may not be available in all browsers) */
  memory?: MemoryStats
  /** Whether all thresholds were met */
  passed: boolean
  /** Individual threshold results */
  thresholds: {
    fps: { passed: boolean; target: number; actual: number }
    renders: { passed: boolean; target: number; actual: number }
    bundle: { passed: boolean; target: number; actual: number }
    memory?: { passed: boolean; target: number; actual: number }
  }
}

/**
 * Calculate a weighted performance score (0-100)
 *
 * Weights (configurable per challenge):
 * - FPS: 35% - Smooth scrolling is essential
 * - Bundle: 30% - Small code wins (every byte counts!)
 * - Render Efficiency: 25% - Fast renders, not fewer renders
 * - Memory: 10% - Stability matters
 */
export function calculatePerfScore(metrics: ReactPerfMetrics, weights?: { fps?: number; bundle?: number; renderEfficiency?: number; memory?: number }): number {
  const w = {
    fps: weights?.fps ?? 35,
    bundle: weights?.bundle ?? 30,
    renderEfficiency: weights?.renderEfficiency ?? 25,
    memory: weights?.memory ?? 10,
  }

  // FPS score: Target 60 FPS, scaled from 0 at 30 FPS to full points at 60+
  const fpsScore = Math.min(1, Math.max(0, (metrics.fps.p95 - 30) / 30)) * w.fps

  // Bundle size score: Target < 1KB gzipped
  // Full points at 500B or less, zero at 2KB+
  const bundleTarget = metrics.thresholds.bundle.target || 1024
  const bundleScore = Math.max(0, 1 - metrics.bundle.gzipped / (bundleTarget * 2)) * w.bundle

  // Render efficiency score: Based on avg commit time, not count
  // Target < 1ms avg, full points at 0.5ms, zero at 2ms+
  const avgRenderTime = metrics.renders.avgCommitTime
  const renderScore = Math.max(0, 1 - avgRenderTime / 2) * w.renderEfficiency

  // Memory stability score
  const memoryScore = metrics.memory?.stable ? w.memory : 0

  return Math.round(fpsScore + renderScore + bundleScore + memoryScore)
}

/**
 * Format metrics for display
 */
export function formatMetrics(metrics: ReactPerfMetrics): string {
  const lines = [
    `  FPS: ${metrics.fps.p95.toFixed(1)} p95 (${metrics.fps.min.toFixed(1)}-${metrics.fps.max.toFixed(1)}) ${metrics.thresholds.fps.passed ? '✓' : '✗'}`,
    `  Renders: ${metrics.renders.renderCount} (avg ${metrics.renders.avgCommitTime.toFixed(2)}ms) ${metrics.thresholds.renders.passed ? '✓' : '✗'}`,
    `  Bundle: ${formatBytes(metrics.bundle.gzipped)} gzip (${formatBytes(metrics.bundle.raw)} raw) ${metrics.thresholds.bundle.passed ? '✓' : '✗'}`,
  ]

  if (metrics.memory) {
    lines.push(
      `  Memory: ${formatBytes(metrics.memory.growth)} growth ${metrics.thresholds.memory?.passed ? '✓' : '✗'}`
    )
  }

  lines.push(`  Score: ${calculatePerfScore(metrics)}/100`)

  return lines.join('\n')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
