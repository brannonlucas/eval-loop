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
  
  // Use a single scan with a cursor approach
  let start = 0
  const len = clean.length
  
  while (start < len) {
    // Find end of current line
    let end = clean.indexOf('\n', start)
    if (end === -1) end = len
    
    // Check for leading significant characters
    let lineStart = start
    while (lineStart < end && (clean.charCodeAt(lineStart) === 32 || clean.charCodeAt(lineStart) === 9)) {
      lineStart++
    }
    
    if (lineStart < end) {
      const firstChar = clean.charAt(lineStart)
      
      if (firstChar === '·' || firstChar === '✓') {
        // Single line processing without creating unnecessary substrings
        const subClean = clean.substring(lineStart, end)
        const match = BENCH_LINE_PATTERN.exec(subClean)
        
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
        // Handle the fallback format
        const subClean = clean.substring(start, end)
        if (subClean.indexOf('ops/sec') !== -1) {
          const trimmed = subClean.trim()
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