export interface BenchResult {
  name: string
  hz: number
  mean: number
  p75: number
  p99: number
}

export function parseBenchResults(output: string): BenchResult[] {
  if (!output) return []
  
  const results: BenchResult[] = []
  const len = output.length
  let i = 0
  
  while (i < len) {
    // Find start of line content (skip whitespace)
    while (i < len) {
      const c = output.charCodeAt(i)
      if (c === 10) { // newline
        i++
        continue
      }
      if (c === 32 || c === 9) { // space or tab
        i++
        continue
      }
      if (c === 27) { // ESC - skip ANSI sequence
        i++
        if (i < len && output.charCodeAt(i) === 91) { // [
          i++
          while (i < len) {
            const cc = output.charCodeAt(i)
            if (cc === 109) { // 'm'
              i++
              break
            }
            i++
          }
        }
        continue
      }
      break
    }
    
    if (i >= len) break
    
    const firstChar = output.charCodeAt(i)
    
    // · is U+00B7 (183), ✓ is U+2713 (10003)
    if (firstChar === 183 || firstChar === 10003) {
      i++ // skip the marker
      
      // Skip whitespace after marker
      while (i < len) {
        const c = output.charCodeAt(i)
        if (c === 10) break
        if (c === 32 || c === 9) { i++; continue }
        if (c === 27) {
          i++
          if (i < len && output.charCodeAt(i) === 91) {
            i++
            while (i < len && output.charCodeAt(i) !== 109) i++
            if (i < len) i++
          }
          continue
        }
        break
      }
      
      // Extract name (until we hit 2+ spaces before a digit)
      let name = ''
      let spaceCount = 0
      let nameEnd = i
      
      while (nameEnd < len) {
        const c = output.charCodeAt(nameEnd)
        if (c === 10) break
        if (c === 27) {
          nameEnd++
          if (nameEnd < len && output.charCodeAt(nameEnd) === 91) {
            nameEnd++
            while (nameEnd < len && output.charCodeAt(nameEnd) !== 109) nameEnd++
            if (nameEnd < len) nameEnd++
          }
          continue
        }
        if (c === 32) {
          spaceCount++
          nameEnd++
          continue
        }
        if (spaceCount >= 2 && c >= 48 && c <= 57) {
          // Found 2+ spaces followed by digit - name ends here
          break
        }
        // Add accumulated spaces and this char to name
        while (spaceCount > 0) { name += ' '; spaceCount-- }
        name += output.charAt(nameEnd)
        nameEnd++
      }
      
      name = name.trim()
      i = nameEnd
      
      // Now parse numeric columns: hz, min, max, mean, p75, p99
      const nums: number[] = []
      
      while (nums.length < 6 && i < len) {
        // Skip whitespace and ANSI
        while (i < len) {
          const c = output.charCodeAt(i)
          if (c === 10) break
          if (c === 32 || c === 9) { i++; continue }
          if (c === 27) {
            i++
            if (i < len && output.charCodeAt(i) === 91) {
              i++
              while (i < len && output.charCodeAt(i) !== 109) i++
              if (i < len) i++
            }
            continue
          }
          break
        }
        
        if (i >= len || output.charCodeAt(i) === 10) break
        
        // Parse number (may have commas)
        let numStr = ''
        while (i < len) {
          const c = output.charCodeAt(i)
          if ((c >= 48 && c <= 57) || c === 46 || c === 44) {
            if (c !== 44) numStr += output.charAt(i)
            i++
          } else if (c === 27) {
            i++
            if (i < len && output.charCodeAt(i) === 91) {
              i++
              while (i < len && output.charCodeAt(i) !== 109) i++
              if (i < len) i++
            }
          } else {
            break
          }
        }
        
        if (numStr) {
          nums.push(parseFloat(numStr))
        }
      }
      
      if (nums.length >= 6 && name) {
        results.push({
          name,
          hz: nums[0],
          mean: nums[3],
          p75: nums[4],
          p99: nums[5]
        })
      }
      
      // Skip to end of line
      while (i < len && output.charCodeAt(i) !== 10) i++
      
    } else {
      // Check for ops/sec format
      let lineStart = i
      let hasOps = false
      let j = i
      
      while (j < len && output.charCodeAt(j) !== 10) {
        if (j + 6 < len && output.charAt(j) === 'o' && output.charAt(j+1) === 'p' && 
            output.charAt(j+2) === 's' && output.charAt(j+3) === '/' && 
            output.charAt(j+4) === 's' && output.charAt(j+5) === 'e' && output.charAt(j+6) === 'c') {
          hasOps = true
          break
        }
        j++
      }
      
      if (hasOps) {
        // Extract line without ANSI
        let line = ''
        let k = lineStart
        while (k < len && output.charCodeAt(k) !== 10) {
          if (output.charCodeAt(k) === 27) {
            k++
            if (k < len && output.charCodeAt(k) === 91) {
              k++
              while (k < len && output.charCodeAt(k) !== 109) k++
              if (k < len) k++
            }
          } else {
            line += output.charAt(k)
            k++
          }
        }
        
        line = line.trim()
        // Parse: name  number ops/sec
        const opsIdx = line.indexOf('ops/sec')
        if (opsIdx > 0) {
          let numEnd = opsIdx - 1
          while (numEnd > 0 && line.charCodeAt(numEnd) === 32) numEnd--
          let numStart = numEnd
          while (numStart > 0) {
            const c = line.charCodeAt(numStart - 1)
            if ((c >= 48 && c <= 57) || c === 46 || c === 44) numStart--
            else break
          }
          
          if (numStart < numEnd + 1) {
            const numStr = line.substring(numStart, numEnd + 1).replace(/,/g, '')
            let nameEnd = numStart - 1
            while (nameEnd > 0 && line.charCodeAt(nameEnd) === 32) nameEnd--
            const name = line.substring(0, nameEnd + 1).trim()
            
            if (name) {
              results.push({
                name,
                hz: parseFloat(numStr),
                mean: 0,
                p75: 0,
                p99: 0
              })
            }
          }
        }
      }
      
      // Skip to end of line
      while (i < len && output.charCodeAt(i) !== 10) i++
    }
    
    if (i < len) i++ // skip newline
  }
  
  return results
}