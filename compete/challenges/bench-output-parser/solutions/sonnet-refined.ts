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
    
    // Skip empty lines quickly
    if (end === start) {
      start++
      continue
    }
    
    // Get line without creating substring if we can avoid it
    // First, skip leading whitespace to find first significant char
    let lineStart = start
    while (lineStart < end) {
      const code = clean.charCodeAt(lineStart)
      if (code !== 32 && code !== 9) break // not space or tab
      lineStart++
    }
    
    if (lineStart < end) {
      const firstChar = clean.charCodeAt(lineStart)
      
      // Only process lines that could be benchmark results
      // · is U+00B7 (183), ✓ is U+2713 but we need to check as string for Unicode
      if (firstChar === 183 || clean.charAt(lineStart) === '✓') { // 183 is ·
        const line = clean.substring(lineStart, end)
        
        // Reset regex lastIndex to avoid stateful regex issues
        BENCH_LINE_PATTERN.lastIndex = 0
        const match = BENCH_LINE_PATTERN.exec(line)
        
        if (match) {
          const hzStr = match[2]
          let hz: number
          if (hzStr.indexOf(',') !== -1) {
            hz = parseFloat(hzStr.replace(/,/g, ''))
          } else {
            hz = parseFloat(hzStr)
          }
          
          results.push({
            name: match[1].trim(),
            hz: hz,
            mean: parseFloat(match[5]),
            p75: parseFloat(match[6]),
            p99: parseFloat(match[7])
          })
        }
      } else {
        // Check for simple format (fallback) - needs "ops/sec" somewhere
        // Quick check first before full substring
        let hasOpsPerSec = false
        for (let i = lineStart; i < end - 6; i++) {
          if (clean.charCodeAt(i) === 111 && // 'o'
              clean.substr(i, 7) === 'ops/sec') {
            hasOpsPerSec = true
            break
          }
        }
        
        if (hasOpsPerSec) {
          const line = clean.substring(start, end).trim()
          SIMPLE_PATTERN.lastIndex = 0
          const match = SIMPLE_PATTERN.exec(line)
          if (match) {
            const hzStr = match[2]
            let hz: number
            if (hzStr.indexOf(',') !== -1) {
              hz = parseFloat(hzStr.replace(/,/g, ''))
            } else {
              hz = parseFloat(hzStr)
            }
            
            results.push({
              name: match[1].trim(),
              hz: hz,
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