/**
 * Bundle Analyzer
 *
 * Measures React component bundle size using esbuild.
 * Externalizes React/ReactDOM to measure only component code.
 */

import * as esbuild from 'esbuild'
import { gzipSync } from 'zlib'
import { existsSync } from 'fs'
import { readFile, rm } from 'fs/promises'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import type { BundleStats } from './react-metrics'

interface BundleAnalysisOptions {
  /** Path to the component entry file */
  entryPoint: string
  /** Whether to minify (default: true) */
  minify?: boolean
  /** Additional external packages beyond react/react-dom */
  external?: string[]
}

/**
 * Analyze bundle size of a React component
 */
export async function analyzeBundle(options: BundleAnalysisOptions): Promise<BundleStats> {
  const { entryPoint, minify = true, external = [] } = options

  if (!existsSync(entryPoint)) {
    throw new Error(`Component file not found: ${entryPoint}`)
  }

  const outfile = join(tmpdir(), `bundle-${Date.now()}.js`)

  try {
    // Build with esbuild
    const result = await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      minify,
      format: 'esm',
      target: 'es2020',
      outfile,
      // Externalize React - we only want to measure component code
      external: ['react', 'react-dom', 'react/jsx-runtime', ...external],
      // Use JSX transform
      jsx: 'automatic',
      // Tree shaking
      treeShaking: true,
      // Don't emit source maps for size measurement
      sourcemap: false,
      // Metafile for detailed analysis
      metafile: true,
      // Quiet output
      logLevel: 'silent',
    })

    // Read the built bundle
    const bundleContents = await readFile(outfile)
    const raw = bundleContents.length
    const gzipped = gzipSync(bundleContents).length

    // Extract chunk information from metafile
    const chunks = Object.entries(result.metafile?.outputs || {}).map(([name, output]) => ({
      name: name.split('/').pop() || name,
      size: output.bytes,
    }))

    return {
      raw,
      gzipped,
      chunks: chunks.length > 1 ? chunks : undefined,
    }
  } finally {
    // Clean up temp file
    if (existsSync(outfile)) {
      await rm(outfile)
    }
  }
}

/**
 * Quick check if bundle is within size limit
 */
export async function checkBundleSize(
  entryPoint: string,
  maxGzipBytes: number
): Promise<{ passed: boolean; stats: BundleStats }> {
  const stats = await analyzeBundle({ entryPoint })
  return {
    passed: stats.gzipped <= maxGzipBytes,
    stats,
  }
}

/**
 * Format bundle stats for display
 */
export function formatBundleStats(stats: BundleStats): string {
  const lines = [
    `Raw: ${formatBytes(stats.raw)}`,
    `Gzipped: ${formatBytes(stats.gzipped)}`,
  ]

  if (stats.chunks && stats.chunks.length > 1) {
    lines.push('Chunks:')
    for (const chunk of stats.chunks) {
      lines.push(`  ${chunk.name}: ${formatBytes(chunk.size)}`)
    }
  }

  return lines.join('\n')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}
