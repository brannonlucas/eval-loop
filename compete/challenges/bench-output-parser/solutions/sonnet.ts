export interface BenchResult {
  name: string
  hz: number      // operations per second
  mean: number    // mean execution time
  p75: number     // 75th percentile
  p99: number     // 99th percentile
}

// Pre-compile regex patterns for better performance
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
const FULL_FORMAT_PATTERN = /^[·✓]\s+(.+?)\s{2,}(\d[\d,]*(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/;
const OPS_SEC_PATTERN = /^[·✓]\s+(.+?)\s{2,}(\d[\d,]*(?:\.\d+)?)\s+ops\/sec/;

export function parseBenchResults(output: string): BenchResult[] {
  if (!output || !output.trim()) {
    return [];
  }

  // Strip all ANSI codes in one pass
  const cleanOutput = output.replace(ANSI_PATTERN, '');
  const results: BenchResult[] = [];
  
  let start = 0;
  let end = cleanOutput.indexOf('\n', start);
  
  // Process line by line without creating array
  while (start < cleanOutput.length) {
    if (end === -1) end = cleanOutput.length;
    
    const line = cleanOutput.slice(start, end);
    
    // Quick check for benchmark markers before regex
    const firstChar = line.trim()[0];
    if (firstChar === '·' || firstChar === '✓') {
      // Try full format first
      const fullMatch = line.match(FULL_FORMAT_PATTERN);
      if (fullMatch) {
        const name = fullMatch[1].trim();
        const hz = parseFloat(fullMatch[2].replace(/,/g, ''));
        const mean = parseFloat(fullMatch[5]);
        const p75 = parseFloat(fullMatch[6]);
        const p99 = parseFloat(fullMatch[7]);
        
        results.push({ name, hz, mean, p75, p99 });
      } else {
        // Try ops/sec fallback format
        const opsMatch = line.match(OPS_SEC_PATTERN);
        if (opsMatch) {
          const name = opsMatch[1].trim();
          const hz = parseFloat(opsMatch[2].replace(/,/g, ''));
          
          results.push({ name, hz, mean: 0, p75: 0, p99: 0 });
        }
      }
    }
    
    start = end + 1;
    end = cleanOutput.indexOf('\n', start);
  }
  
  return results;
}