export interface BenchResult {
  name: string
  hz: number
  mean: number
  p75: number
  p99: number
}

// Pre-compiled regex patterns at module level
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g

// Match benchmark data line: starts with · or ✓, has name, then numeric columns
// Captures: name, hz, min, max, mean, p75, p99
const BENCH_LINE_PATTERN = /^[·✓]\s+(.+?)\s{2,}([0-9,]+(?:\.[0-9]+)?)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/

// Fallback pattern for simpler format: "name  1,234 ops/sec"
const SIMPLE_PATTERN = /^(.+?)\s{2,}([0-9,]+(?:\.[0-9]+)?)\s+ops\/sec/

export function parseBenchResults(output: string): BenchResult[] {
  if (!output) return []
  
  // Strip ALL ANSI codes in one pass from the entire string
  const clean = output.replace(ANSI_PATTERN, '')
  
  const results: BenchResult[] = []
  
  // Process line by line without creating full array upfront
  let start = 0
  const len = clean.length
  
  while (start < len) {
    // Find end of current line
    let end = clean.indexOf('\n', start)
    if (end === -1) end = len
    
    // Get line without creating substring if we can avoid it
    // First, skip leading whitespace to find first significant char
    let lineStart = start
    while (lineStart < end && (clean.charCodeAt(lineStart) === 32 || clean.charCodeAt(lineStart) === 9)) {
      lineStart++
    }
    
    if (lineStart < end) {
      const firstChar = clean.charAt(lineStart)
      
      // Only process lines that could be benchmark results
      // · is U+00B7 (183), ✓ is U+2713 (10003)
      if (firstChar === '·' || firstChar === '✓') {
        const line = clean.substring(lineStart, end)
        const match = BENCH_LINE_PATTERN.exec(line)
        
        if (match) {
          results.push({
            name: match[1].trim(),
            hz: parseFloat(match[2].replace(/,/g, '')),
            mean: parseFloat(match[5]),
            p75: parseFloat(match[6]),
            p99: parseFloat(match[7])
          })
        }
      } else {
        // Check for simple format (fallback) - needs "ops/sec" somewhere
        const line = clean.substring(start, end)
        if (line.indexOf('ops/sec') !== -1) {
          const trimmed = line.trim()
          const match = SIMPLE_PATTERN.exec(trimmed)
          if (match) {
            results.push({
              name: match[1].trim(),
              hz: parseFloat(match[2].replace(/,/g, '')),
              mean: 0,
              p75: 0,
              p99: 0
            })
          }
        }
      }
    }
    
    start = end + 1
  }
  
  return results
}