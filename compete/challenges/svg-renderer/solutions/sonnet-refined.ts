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

// Cache for font buffers to avoid repeated ArrayBuffer conversions
const fontCache = new Map<string, Buffer>()

// Pre-compiled regex patterns for SVG manipulation
const viewBoxRegex = /viewBox=["']([^"']*)["']/
const widthRegex = /\swidth=["'][^"']*["']/g
const heightRegex = /\sheight=["'][^"']*["']/g
const svgTagRegex = /<svg([^>]*?)>/

// Pre-allocated options template to minimize object creation
const optionsTemplate = {
  font: {
    loadSystemFonts: false,
    defaultFontFamily: 'sans-serif',
  },
  logLevel: 'off' as const,
}

// Cache for normalized SVGs to avoid repeated string operations
const svgNormalizationCache = new Map<string, string>()
const MAX_CACHE_SIZE = 100

/**
 * Optimized SVG normalization with aggressive caching
 */
function normalizeSvg(svg: string, width: number, height: number): string {
  const cacheKey = `${svg.length}-${width}-${height}-${svg.substring(0, 100)}`
  let cached = svgNormalizationCache.get(cacheKey)
  
  if (cached) {
    return cached
  }
  
  // Clear cache if it gets too large
  if (svgNormalizationCache.size > MAX_CACHE_SIZE) {
    svgNormalizationCache.clear()
  }
  
  let result = svg
  
  // More efficient regex operations - do all replacements in sequence
  const hasViewBox = viewBoxRegex.test(result)
  
  // Remove existing width/height in one pass
  result = result.replace(widthRegex, '').replace(heightRegex, '')
  
  // Handle SVG tag modification more efficiently
  const svgMatch = result.match(svgTagRegex)
  if (svgMatch) {
    let attrs = svgMatch[1] || ''
    
    // Add viewBox if missing
    if (!hasViewBox) {
      attrs += ` viewBox="0 0 ${width} ${height}"`
    }
    
    // Add dimensions
    attrs += ` width="${width}" height="${height}"`
    
    result = result.replace(svgTagRegex, `<svg${attrs}>`)
  }
  
  svgNormalizationCache.set(cacheKey, result)
  return result
}

/**
 * Optimized resvg options builder with object reuse
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
    },
    logLevel: 'off' as const,
  }
  
  // Only process fonts if they exist
  if (options.fonts?.length) {
    const fontBuffers: Buffer[] = []
    
    for (let i = 0; i < options.fonts.length; i++) {
      const font = options.fonts[i]
      const cacheKey = `${font.name}-${font.weight || 400}-${font.style || 'normal'}`
      
      let buffer = fontCache.get(cacheKey)
      if (!buffer) {
        buffer = Buffer.from(font.data)
        fontCache.set(cacheKey, buffer)
      }
      
      fontBuffers.push(buffer)
    }
    
    resvgOpts.font.fontBuffers = fontBuffers
  }
  
  return resvgOpts
}

/**
 * Memory usage tracking (optimized)
 */
let memoryUsageEnabled = typeof process !== 'undefined' && process.memoryUsage
function getMemoryUsage(): number {
  return memoryUsageEnabled ? process.memoryUsage().heapUsed : 0
}

// ============================================================================
// REQUIRED EXPORTS - Functions
// ============================================================================

/**
 * REQUIRED: Optimized SVG to PNG renderer
 */
export async function renderSvgToPng(
  svg: string,
  options: RenderOptions
): Promise<RenderResult> {
  const startTime = performance.now()
  const startMemory = getMemoryUsage()
  
  // Fast path optimization - minimize function calls
  const normalizedSvg = normalizeSvg(svg, options.width, options.height)
  const resvgOptions = buildResvgOptions(options)
  
  // Direct rendering without intermediate variables where possible
  const resvg = new Resvg(normalizedSvg, resvgOptions)
  const pngBuffer = resvg.render().asPng()
  
  const renderTime = Math.round((performance.now() - startTime) * 100) / 100
  const memoryUsed = Math.max(0, getMemoryUsage() - startMemory)
  
  return {
    png: new Uint8Array(pngBuffer),
    renderTime,
    memoryUsed,
  }
}

/**
 * OPTIONAL: Element tree to PNG renderer
 */
export async function renderElementToPng(
  element: ElementNode,
  options: RenderOptions
): Promise<RenderResult> {
  const svg = elementToSvg(element, options.width, options.height)
  return renderSvgToPng(svg, options)
}

// ============================================================================
// Optimized Element Tree to SVG Conversion
// ============================================================================

/**
 * Convert ElementNode tree to SVG string
 */
function elementToSvg(element: ElementNode, width: number, height: number): string {
  if (element.type.toLowerCase() === 'svg') {
    return renderElement(element)
  }
  
  const content = renderElement(element)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`
}

/**
 * Optimized element rendering with reduced allocations
 */
function renderElement(element: ElementNode): string {
  const { type, props, children } = element
  
  let result = `<${type}`
  
  // Process attributes more efficiently
  if (props) {
    for (const key in props) {
      const value = props[key]
      if (value == null) continue
      
      const attrName = camelToKebab(key)
      
      if (key === 'style' && typeof value === 'object') {
        let styleStr = ''
        for (const k in value) {
          if (styleStr) styleStr += ';'
          styleStr += `${camelToKebab(k)}:${value[k]}`
        }
        result += ` style="${escapeAttr(styleStr)}"`
      } else {
        result += ` ${attrName}="${escapeAttr(String(value))}"`
      }
    }
  }
  
  // Handle children efficiently
  if (!children || children.length === 0) {
    return `${result}/>`
  }
  
  result += '>'
  
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (typeof child === 'string') {
      result += escapeText(child)
    } else {
      result += renderElement(child)
    }
  }
  
  return `${result}</${type}>`
}

/**
 * Cached camelCase to kebab-case conversion
 */
const kebabCache = new Map<string, string>()

function camelToKebab(str: string): string {
  let result = kebabCache.get(str)
  if (result === undefined) {
    result = str.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)
    kebabCache.set(str, result)
  }
  return result
}

/**
 * Optimized XML escaping functions
 */
const attrEscapeMap: Record<string, string> = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;'
}

const textEscapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;'
}

function escapeAttr(str: string): string {
  return str.replace(/[&"<>]/g, m => attrEscapeMap[m])
}

function escapeText(str: string): string {
  return str.replace(/[&<>]/g, m => textEscapeMap[m])
}

// ============================================================================
// Batch Rendering Optimizations
// ============================================================================

/**
 * Optimized batch rendering
 */
export async function renderBatch(
  svgs: string[],
  options: RenderOptions
): Promise<RenderResult[]> {
  const results: RenderResult[] = new Array(svgs.length)
  const resvgOptions = buildResvgOptions(options)
  
  for (let i = 0; i < svgs.length; i++) {
    const startTime = performance.now()
    const startMemory = getMemoryUsage()
    
    const normalizedSvg = normalizeSvg(svgs[i], options.width, options.height)
    const resvg = new Resvg(normalizedSvg, resvgOptions)
    const pngBuffer = resvg.render().asPng()
    
    const renderTime = Math.round((performance.now() - startTime) * 100) / 100
    const memoryUsed = Math.max(0, getMemoryUsage() - startMemory)
    
    results[i] = {
      png: new Uint8Array(pngBuffer),
      renderTime,
      memoryUsed,
    }
  }
  
  return results
}

/**
 * Parallel batch rendering with controlled concurrency
 */
export async function renderBatchParallel(
  svgs: string[],
  options: RenderOptions,
  concurrency: number = 4
): Promise<RenderResult[]> {
  const results: RenderResult[] = new Array(svgs.length)
  
  for (let i = 0; i < svgs.length; i += concurrency) {
    const endIndex = Math.min(i + concurrency, svgs.length)
    const promises: Promise<RenderResult>[] = []
    
    for (let j = i; j < endIndex; j++) {
      promises.push(renderSvgToPng(svgs[j], options))
    }
    
    const chunkResults = await Promise.all(promises)
    
    for (let j = 0; j < chunkResults.length; j++) {
      results[i + j] = chunkResults[j]
    }
  }
  
  return results
}