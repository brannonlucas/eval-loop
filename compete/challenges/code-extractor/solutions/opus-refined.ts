// Use hex codes to avoid backtick issues in extraction
const FENCE = '\x60\x60\x60';
const FENCE_LEN = 3;

export function extractCode(response: string): string {
  // Fast path for empty/whitespace
  const len = response.length;
  if (len === 0) return '';
  
  // Check if entirely whitespace
  let hasNonWhitespace = false;
  for (let i = 0; i < len; i++) {
    const c = response.charCodeAt(i);
    if (c !== 32 && c !== 9 && c !== 10 && c !== 13) {
      hasNonWhitespace = true;
      break;
    }
  }
  if (!hasNonWhitespace) return '';
  
  // Priority 1: Code blocks
  let searchStart = 0;
  
  while (searchStart < len) {
    const fenceStart = response.indexOf(FENCE, searchStart);
    if (fenceStart === -1) break;
    
    // Find the end of the opening fence line
    const lineEnd = response.indexOf('\n', fenceStart + FENCE_LEN);
    if (lineEnd === -1) break;
    
    // Find closing fence
    const fenceEnd = response.indexOf(FENCE, lineEnd + 1);
    if (fenceEnd === -1) break;
    
    // Extract the code between fences
    const code = response.substring(lineEnd + 1, fenceEnd).trim();
    
    // If code is empty, try next block
    if (code.length === 0) {
      searchStart = fenceEnd + FENCE_LEN;
      continue;
    }
    
    return code;
  }
  
  // Priority 2: Raw code detection - check if starts with code indicator
  const trimmed = response.trim();
  const trimmedLen = trimmed.length;
  
  if (trimmedLen > 0) {
    const c0 = trimmed.charCodeAt(0);
    
    // Check for // or /*
    if (c0 === 47 && trimmedLen > 1) { // '/'
      const c1 = trimmed.charCodeAt(1);
      if (c1 === 47 || c1 === 42) { // '/' or '*'
        return trimmed;
      }
    }
    
    // Check keywords by first char
    if (c0 === 105) { // 'i' - import, interface
      if (trimmed.startsWith('import') || trimmed.startsWith('interface')) {
        return trimmed;
      }
    } else if (c0 === 101) { // 'e' - export
      if (trimmed.startsWith('export')) {
        return trimmed;
      }
    } else if (c0 === 99) { // 'c' - const, class
      if (trimmed.startsWith('const') || trimmed.startsWith('class')) {
        return trimmed;
      }
    } else if (c0 === 108) { // 'l' - let
      if (trimmed.startsWith('let')) {
        return trimmed;
      }
    } else if (c0 === 118) { // 'v' - var
      if (trimmed.startsWith('var')) {
        return trimmed;
      }
    } else if (c0 === 102) { // 'f' - function
      if (trimmed.startsWith('function')) {
        return trimmed;
      }
    } else if (c0 === 116) { // 't' - type
      if (trimmed.startsWith('type')) {
        return trimmed;
      }
    } else if (c0 === 97) { // 'a' - async
      if (trimmed.startsWith('async')) {
        return trimmed;
      }
    }
  }
  
  // Priority 3: Prose + code - find first line that looks like code
  let lineStart = 0;
  
  while (lineStart < len) {
    // Skip leading whitespace on line
    while (lineStart < len) {
      const c = response.charCodeAt(lineStart);
      if (c !== 32 && c !== 9) break;
      lineStart++;
    }
    
    if (lineStart >= len) break;
    
    const c0 = response.charCodeAt(lineStart);
    
    // Find end of current line for substring operations
    let lineEnd = response.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = len;
    
    let isCode = false;
    
    // Check for // or /*
    if (c0 === 47 && lineStart + 1 < len) { // '/'
      const c1 = response.charCodeAt(lineStart + 1);
      if (c1 === 47 || c1 === 42) { // '/' or '*'
        isCode = true;
      }
    }
    
    if (!isCode) {
      // Check keywords - need enough characters
      const remaining = lineEnd - lineStart;
      
      if (c0 === 105 && remaining >= 6) { // 'i' - import (6), interface (9)
        if (response.substring(lineStart, lineStart + 6) === 'import' ||
            (remaining >= 9 && response.substring(lineStart, lineStart + 9) === 'interface')) {
          isCode = true;
        }
      } else if (c0 === 101 && remaining >= 6) { // 'e' - export
        if (response.substring(lineStart, lineStart + 6) === 'export') {
          isCode = true;
        }
      } else if (c0 === 99 && remaining >= 5) { // 'c' - const, class
        if (response.substring(lineStart, lineStart + 5) === 'const' ||
            response.substring(lineStart, lineStart + 5) === 'class') {
          isCode = true;
        }
      } else if (c0 === 108 && remaining >= 3) { // 'l' - let
        if (response.substring(lineStart, lineStart + 3) === 'let') {
          isCode = true;
        }
      } else if (c0 === 118 && remaining >= 3) { // 'v' - var
        if (response.substring(lineStart, lineStart + 3) === 'var') {
          isCode = true;
        }
      } else if (c0 === 102 && remaining >= 8) { // 'f' - function
        if (response.substring(lineStart, lineStart + 8) === 'function') {
          isCode = true;
        }
      } else if (c0 === 116 && remaining >= 4) { // 't' - type
        if (response.substring(lineStart, lineStart + 4) === 'type') {
          isCode = true;
        }
      }
    }
    
    if (isCode) {
      return response.substring(lineStart).trim();
    }
    
    lineStart = lineEnd + 1;
  }
  
  // Fallback: return trimmed response
  return trimmed;
}