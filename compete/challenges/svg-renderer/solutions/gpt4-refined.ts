import { Resvg } from '@resvg/resvg-js'

// ============================================================================
// REQUIRED EXPORTS - Interfaces
// ============================================================================

export interface RenderOptions {
  width: number
  height: number
  fonts?: FontConfig[]
}

export interface FontConfig {
  name: string
  data: ArrayBuffer
  weight?: number
  style?: 'normal' | 'italic'
}

export interface RenderResult {
  png: Uint8Array
  renderTime: number
  memoryUsed?: number
}

export interface ElementNode {
  type: string
  props?: Record<string, any>
  children?: (ElementNode | string)[]
}

// ============================================================================
// Performance Optimizations
// ============================================================================

// Cache for font data to avoid repeated ArrayBuffer conversions
const fontCache = new Map<string, Uint8Array>()

// Pre-compiled regex patterns for SVG manipulation (avoid re-compilation)
const viewBoxRegex = /viewBox=["']([^"']*)["']/
const widthRegex = /(<svg[^>]*)\swidth=["'][^"']*["']/
const heightRegex = /(<svg[^>]*)\sheight=["'][^"']*["']/
const svgTagRegex = /(<svg)(\s|>)/

// Reusable options object to reduce allocations
const baseResvgOptions = {
  fitTo: { mode: 'width' as const, value: 0 },
  font: {
    loadSystemFonts: false,
    defaultFontFamily: 'sans-serif',
  },
  logLevel: 'off' as const,
}

/**
 * Normalize SVG to ensure proper dimensions and viewBox
 * This is critical for correct scaling at different output sizes
 */
function normalizeSvg(svg: string, width: number, height: number): string {
  let result = svg
  
  // Check if viewBox exists
  const hasViewBox = viewBoxRegex.test(result)
  
  // Remove existing width/height attributes to let fitTo handle sizing
  result = result.replace(widthRegex, '$1')
  result = result.replace(heightRegex, '$1')
  
  // Add viewBox if missing (use target dimensions as default)
  if (!hasViewBox) {
    result = result.replace(svgTagRegex, `$1 viewBox="0 0 ${width} ${height}"$2`)
  }
  
  // Add width/height attributes for proper aspect ratio
  result = result.replace(svgTagRegex, `$1 width="${width}" height="${height}"$2`)
  
  return result
}

/**
 * Build resvg options with font configuration
 * Reuses base options object to minimize allocations
 */
function buildResvgOptions(options: RenderOptions): any {
  const resvgOpts: any = {
    fitTo: { 
      mode: 'width' as const, 
      value: options.width 
    },
    font: {
      loadSystemFonts: false,
      defaultFontFamily: 'sans-serif',
      fontBuffers: [] as Uint8Array[],
    },
    logLevel: 'off' as const,
  }
  
  // Add custom fonts if provided
  if (options.fonts && options.fonts.length > 0) {
    for (const font of options.fonts) {
      // Check cache first
      const cacheKey = `${font.name}-${font.weight || 400}-${font.style || 'normal'}`
      let buffer = fontCache.get(cacheKey)
      
      if (!buffer) {
        buffer = new Uint8Array(font.data)
        fontCache.set(cacheKey, buffer)
      }
      
      resvgOpts.font.fontBuffers.push(buffer)
    }
  }
  
  return resvgOpts
}

/**
 * Get memory usage in bytes (approximate)
 */
function getMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed
  }
  return 0
}

// ============================================================================
// REQUIRED EXPORTS - Functions
// ============================================================================

/**
 * REQUIRED: Render an SVG string to a PNG buffer
 * 
 * Optimizations applied:
 * 1. SVG normalization for consistent scaling
 * 2. Font caching to avoid repeated conversions
 * 3. Minimal object allocation in hot path
 * 4. Direct Uint8Array output (no intermediate conversions)
 */
export async function renderSvgToPng(
  svg: string,
  options: RenderOptions
): Promise<RenderResult> {
  const startTime = performance.now()
  const startMemory = getMemoryUsage()
  
  // Normalize SVG for target dimensions
  const normalizedSvg = normalizeSvg(svg, options.width, options.height)
  
  // Build options with font config
  const resvgOptions = buildResvgOptions(options)
  
  // Create Resvg instance and render
  const resvg = new Resvg(normalizedSvg, resvgOptions)
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  
  const endTime = performance.now()
  const endMemory = getMemoryUsage()
  
  return {
    png: pngBuffer,
    renderTime: Math.round((endTime - startTime) * 100) / 100,
    memoryUsed: Math.max(0, endMemory - startMemory),
  }
}

/**
 * OPTIONAL: Render an element tree (React-like) to PNG
 * 
 * Converts ElementNode tree to SVG string, then renders via renderSvgToPng
 */
export async function renderElementToPng(
  element: ElementNode,
  options: RenderOptions
): Promise<RenderResult> {
  const svg = elementToSvg(element, options.width, options.height)
  return renderSvgToPng(svg, options)
}

// ============================================================================
// Element Tree to SVG Conversion
// ============================================================================

/**
 * Convert ElementNode tree to SVG string
 */
function elementToSvg(element: ElementNode, width: number, height: number): string {
  const content = renderElement(element)
  
  // Wrap in SVG if not already an SVG element
  if (element.type.toLowerCase() === 'svg') {
    return content
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`
}

/**
 * Recursively render ElementNode to string
 * Optimized with string concatenation instead of array joins
 */
function renderElement(element: ElementNode): string {
  const { type, props = {}, children = [] } = element
  
  // Build attributes string
  let attrs = ''
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue
    
    // Convert camelCase to kebab-case for SVG attributes
    const attrName = camelToKebab(key)
    
    // Handle style objects
    if (key === 'style' && typeof value === 'object') {
      const styleStr = Object.entries(value)
        .map(([k, v]) => `${camelToKebab(k)}:${v}`)
        .join(';')
      attrs += ` style="${escapeAttr(styleStr)}"`
    } else {
      attrs += ` ${attrName}="${escapeAttr(String(value))}"`
    }
  }
  
  // Self-closing tags for empty elements
  if (children.length === 0) {
    return `<${type}${attrs}/>`
  }
  
  // Render children
  let childContent = ''
  for (const child of children) {
    if (typeof child === 'string') {
      childContent += escapeText(child)
    } else {
      childContent += renderElement(child)
    }
  }
  
  return `<${type}${attrs}>${childContent}</${type}>`
}

/**
 * Convert camelCase to kebab-case
 * Cached for performance on repeated attribute names
 */
const kebabCache = new Map<string, string>()

function camelToKebab(str: string): string {
  let result = kebabCache.get(str)
  if (result === undefined) {
    result = str.replace(/([A-Z])/g, '-$1').toLowerCase()
    kebabCache.set(str, result)
  }
  return result
}

/**
 * Escape XML attribute value
 */
function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Escape XML text content
 */
function escapeText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ============================================================================
// Batch Rendering (Bonus optimization for multiple cards)
// ============================================================================

/**
 * Batch render multiple SVGs efficiently
 * Amortizes setup costs across multiple renders
 */
export async function renderBatch(
  svgs: string[],
  options: RenderOptions
): Promise<RenderResult[]> {
  const results: RenderResult[] = []
  
  // Pre-build options once for all renders
  const resvgOptions = buildResvgOptions(options)
  
  for (const svg of svgs) {
    const startTime = performance.now()
    const startMemory = getMemoryUsage()
    
    const normalizedSvg = normalizeSvg(svg, options.width, options.height)
    const resvg = new Resvg(normalizedSvg, resvgOptions)
    const pngBuffer = resvg.render().asPng()
    
    const endTime = performance.now()
    const endMemory = getMemoryUsage()
    
    results.push({
      png: pngBuffer,
      renderTime: Math.round((endTime - startTime) * 100) / 100,
      memoryUsed: Math.max(0, endMemory - startMemory),
    })
  }
  
  return results
}

/**
 * Parallel batch rendering for maximum throughput
 * Uses Promise.all for concurrent rendering when possible
 */
export async function renderBatchParallel(
  svgs: string[],
  options: RenderOptions,
  concurrency: number = 4
): Promise<RenderResult[]> {
  const results: RenderResult[] = new Array(svgs.length)
  
  // Process in chunks to limit concurrency
  for (let i = 0; i < svgs.length; i += concurrency) {
    const chunk = svgs.slice(i, i + concurrency)
    const chunkResults = await Promise.all(
      chunk.map(svg => renderSvgToPng(svg, options))
    )
    
    for (let j = 0; j < chunkResults.length; j++) {
      results[i + j] = chunkResults[j]
    }
  }
  
  return results
}