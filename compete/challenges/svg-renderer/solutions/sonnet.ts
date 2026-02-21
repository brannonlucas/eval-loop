import { Resvg } from '@resvg/resvg-js'

// REQUIRED EXPORTS
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

// Cache for reused Resvg instances and configurations
const resvgCache = new Map<string, any>()
const configCache = new Map<string, any>()

// Pre-compile font configurations to avoid repeated processing
function prepareFontConfig(fonts?: FontConfig[]) {
  if (!fonts || fonts.length === 0) return undefined
  
  const fontKey = fonts.map(f => `${f.name}-${f.weight || 400}-${f.style || 'normal'}`).join('|')
  
  if (configCache.has(fontKey)) {
    return configCache.get(fontKey)
  }
  
  const fontConfig = fonts.map(font => ({
    family: font.name,
    data: font.data,
    weight: font.weight || 400,
    style: font.style || 'normal'
  }))
  
  configCache.set(fontKey, fontConfig)
  return fontConfig
}

// Optimize SVG string preprocessing
function preprocessSvg(svg: string, width: number, height: number): string {
  // Quick validation - check if it's already properly formatted
  if (svg.includes(`width="${width}"`) && svg.includes(`height="${height}"`)) {
    return svg
  }
  
  // Only modify SVG if dimensions need adjustment
  let processedSvg = svg
  
  // Ensure proper dimensions are set on root SVG element
  const svgTagMatch = processedSvg.match(/<svg[^>]*>/)
  if (svgTagMatch) {
    let svgTag = svgTagMatch[0]
    
    // Update or add width/height attributes efficiently
    if (svgTag.includes('width=')) {
      svgTag = svgTag.replace(/width="[^"]*"/, `width="${width}"`)
    } else {
      svgTag = svgTag.replace('<svg', `<svg width="${width}"`)
    }
    
    if (svgTag.includes('height=')) {
      svgTag = svgTag.replace(/height="[^"]*"/, `height="${height}"`)
    } else {
      svgTag = svgTag.replace('<svg', `<svg height="${height}"`)
    }
    
    // Ensure proper viewBox if not present
    if (!svgTag.includes('viewBox=')) {
      svgTag = svgTag.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`)
    }
    
    processedSvg = processedSvg.replace(svgTagMatch[0], svgTag)
  }
  
  return processedSvg
}

/**
 * REQUIRED: Render an SVG string to a PNG buffer
 */
export async function renderSvgToPng(
  svg: string,
  options: RenderOptions
): Promise<RenderResult> {
  const startTime = performance.now()
  const initialMemory = process.memoryUsage().heapUsed
  
  try {
    const { width, height, fonts } = options
    
    // Preprocess SVG with optimized string operations
    const processedSvg = preprocessSvg(svg, width, height)
    
    // Prepare font configuration (cached)
    const fontConfig = prepareFontConfig(fonts)
    
    // Create optimized resvg configuration
    const resvgOptions: any = {
      fitTo: {
        mode: 'width',
        value: width
      },
      font: {
        loadSystemFonts: false, // Faster startup
        fontFiles: fontConfig || [],
        defaultFontFamily: 'Arial'
      }
    }
    
    // Create cache key for potential reuse
    const cacheKey = `${width}x${height}-${svg.length}-${fontConfig?.length || 0}`
    
    // Create Resvg instance
    const resvg = new Resvg(processedSvg, resvgOptions)
    
    // Render to PNG buffer
    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()
    
    const endTime = performance.now()
    const finalMemory = process.memoryUsage().heapUsed
    
    return {
      png: pngBuffer,
      renderTime: Math.round((endTime - startTime) * 100) / 100, // Round to 2 decimal places
      memoryUsed: Math.max(0, finalMemory - initialMemory)
    }
    
  } catch (error) {
    const endTime = performance.now()
    console.error('SVG rendering failed:', error)
    throw new Error(`SVG rendering failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * OPTIONAL: Render an element tree (React-like) to PNG
 * This is a basic implementation that converts elements to SVG
 */
export async function renderElementToPng(
  element: ElementNode,
  options: RenderOptions
): Promise<RenderResult> {
  const startTime = performance.now()
  
  try {
    // Convert element tree to SVG string
    const svg = elementToSvg(element, options.width, options.height)
    
    // Render using the main SVG renderer
    const result = await renderSvgToPng(svg, options)
    
    // Adjust timing to include element conversion
    const totalTime = performance.now() - startTime
    
    return {
      ...result,
      renderTime: Math.round(totalTime * 100) / 100
    }
    
  } catch (error) {
    console.error('Element rendering failed:', error)
    throw new Error(`Element rendering failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Helper function to convert element tree to SVG
function elementToSvg(element: ElementNode, width: number, height: number): string {
  const svgContent = elementToSvgRecursive(element)
  
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${svgContent}
  </svg>`
}

function elementToSvgRecursive(element: ElementNode | string): string {
  if (typeof element === 'string') {
    return element
  }
  
  const { type, props = {}, children = [] } = element
  
  // Handle basic SVG elements
  const attributes = Object.entries(props)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')
  
  const childContent = children
    .map(child => elementToSvgRecursive(child))
    .join('')
  
  if (childContent) {
    return `<${type} ${attributes}>${childContent}</${type}>`
  } else {
    return `<${type} ${attributes}/>`
  }
}

// Cleanup function to manage cache size
function cleanupCaches() {
  if (resvgCache.size > 100) {
    const entries = Array.from(resvgCache.entries())
    const keepEntries = entries.slice(-50) // Keep most recent 50
    resvgCache.clear()
    keepEntries.forEach(([key, value]) => resvgCache.set(key, value))
  }
  
  if (configCache.size > 50) {
    const entries = Array.from(configCache.entries())
    const keepEntries = entries.slice(-25) // Keep most recent 25
    configCache.clear()
    keepEntries.forEach(([key, value]) => configCache.set(key, value))
  }
}

// Periodic cleanup to prevent memory leaks
setInterval(cleanupCaches, 60000) // Every minute