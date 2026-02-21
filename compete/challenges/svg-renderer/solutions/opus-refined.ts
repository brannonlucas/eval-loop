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

// Cache for font buffers to avoid repeated conversions
const fontBufferCache = new Map<ArrayBuffer, Buffer>()

// Cache for resvg options by dimensions + fonts hash
const optionsCache = new Map<string, any>()

// Pre-compiled regex patterns - use simpler patterns where possible
const viewBoxRegex = /viewBox\s*=\s*["']([^"']*)["']/
const svgOpenTagRegex = /<svg([^>]*)>/

/**
 * Fast SVG normalization - single pass modification
 */
function normalizeSvg(svg: string, width: number, height: number): string {
  const match = svg.match(svgOpenTagRegex)
  if (!match) return svg
  
  const fullMatch = match[0]
  let attrs = match[1]
  
  // Check existing attributes
  const hasViewBox = /viewBox\s*=/.test(attrs)
  const hasWidth = /\swidth\s*=/.test(attrs)
  const hasHeight = /\sheight\s*=/.test(attrs)
  
  // Remove existing width/height
  if (hasWidth) {
    attrs = attrs.replace(/\swidth\s*=\s*["'][^"']*["']/g, '')
  }
  if (hasHeight) {
    attrs = attrs.replace(/\sheight\s*=\s*["'][^"']*["']/g, '')
  }
  
  // Build new attributes
  let newAttrs = attrs
  if (!hasViewBox) {
    newAttrs += ` viewBox="0 0 ${width} ${height}"`
  }
  newAttrs += ` width="${width}" height="${height}"`
  
  return svg.replace(fullMatch, `<svg${newAttrs}>`)
}

/**
 * Build resvg options with aggressive caching
 */
function buildResvgOptions(options: RenderOptions): any {
  // Create cache key
  const fontsKey = options.fonts ? options.fonts.length.toString() : '0'
  const cacheKey = `${options.width}|${fontsKey}`
  
  let cached = optionsCache.get(cacheKey)
  if (cached && (!options.fonts || cached._fontCount === options.fonts.length)) {
    // Update width in case it changed
    cached.fitTo.value = options.width
    return cached
  }
  
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
    _fontCount: options.fonts?.length || 0
  }
  
  // Add custom fonts if provided
  if (options.fonts && options.fonts.length > 0) {
    const fontBuffers: Buffer[] = new Array(options.fonts.length)
    
    for (let i = 0; i < options.fonts.length; i++) {
      const font = options.fonts[i]
      let buffer = fontBufferCache.get(font.data)
      
      if (!buffer) {
        buffer = Buffer.from(font.data)
        fontBufferCache.set(font.data, buffer)
      }
      
      fontBuffers[i] = buffer
    }
    
    resvgOpts.font.fontBuffers = fontBuffers
  }
  
  optionsCache.set(cacheKey, resvgOpts)
  return resvgOpts
}

// ============================================================================
// REQUIRED EXPORTS - Functions
// ============================================================================

/**
 * REQUIRED: Render an SVG string to a PNG buffer
 */
export async function renderSvgToPng(
  svg: string,
  options: RenderOptions
): Promise<RenderResult> {
  const startTime = performance.now()
  
  // Normalize SVG for target dimensions
  const normalizedSvg = normalizeSvg(svg, options.width, options.height)
  
  // Build options with font config
  const resvgOptions = buildResvgOptions(options)
  
  // Create Resvg instance and render
  const resvg = new Resvg(normalizedSvg, resvgOptions)
  const pngBuffer = resvg.render().asPng()
  
  const endTime = performance.now()
  
  return {
    png: pngBuffer,
    renderTime: endTime - startTime,
    memoryUsed: 0,
  }
}

/**
 * OPTIONAL: Render an element tree (React-like) to PNG
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
  
  if (element.type.toLowerCase() === 'svg') {
    return content
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`
}

/**
 * Recursively render ElementNode to string - optimized
 */
function renderElement(element: ElementNode): string {
  const { type, props, children } = element
  
  // Build attributes string
  let attrs = ''
  if (props) {
    const entries = Object.entries(props)
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i]
      if (value === undefined || value === null) continue
      
      const attrName = camelToKebab(key)
      
      if (key === 'style' && typeof value === 'object') {
        const styleEntries = Object.entries(value)
        let styleStr = ''
        for (let j = 0; j < styleEntries.length; j++) {
          const [k, v] = styleEntries[j]
          if (j > 0) styleStr += ';'
          styleStr += `${camelToKebab(k)}:${v}`
        }
        attrs += ` style="${escapeAttr(styleStr)}"`
      } else {
        attrs += ` ${attrName}="${escapeAttr(String(value))}"`
      }
    }
  }
  
  // Self-closing tags for empty elements
  if (!children || children.length === 0) {
    return `<${type}${attrs}/>`
  }
  
  // Render children
  let childContent = ''
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (typeof child === 'string') {
      childContent += escapeText(child)
    } else {
      childContent += renderElement(child)
    }
  }
  
  return `<${type}${attrs}>${childContent}</${type}>`
}

/**
 * Convert camelCase to kebab-case with caching
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
  if (!/[&"<>]/.test(str)) return str
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
  if (!/[&<>]/.test(str)) return str
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ============================================================================
// Batch Rendering
// ============================================================================

/**
 * Batch render multiple SVGs efficiently
 */
export async function renderBatch(
  svgs: string[],
  options: RenderOptions
): Promise<RenderResult[]> {
  const results: RenderResult[] = new Array(svgs.length)
  const resvgOptions = buildResvgOptions(options)
  
  for (let i = 0; i < svgs.length; i++) {
    const startTime = performance.now()
    
    const normalizedSvg = normalizeSvg(svgs[i], options.width, options.height)
    const resvg = new Resvg(normalizedSvg, resvgOptions)
    const pngBuffer = resvg.render().asPng()
    
    results[i] = {
      png: pngBuffer,
      renderTime: performance.now() - startTime,
      memoryUsed: 0,
    }
  }
  
  return results
}

/**
 * Parallel batch rendering
 */
export async function renderBatchParallel(
  svgs: string[],
  options: RenderOptions,
  concurrency: number = 4
): Promise<RenderResult[]> {
  const results: RenderResult[] = new Array(svgs.length)
  
  for (let i = 0; i < svgs.length; i += concurrency) {
    const chunk = svgs.slice(i, Math.min(i + concurrency, svgs.length))
    const chunkResults = await Promise.all(
      chunk.map(svg => renderSvgToPng(svg, options))
    )
    
    for (let j = 0; j < chunkResults.length; j++) {
      results[i + j] = chunkResults[j]
    }
  }
  
  return results
}