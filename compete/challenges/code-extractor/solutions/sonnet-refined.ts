// Use hex codes to avoid backtick issues in extraction
const FENCE = '\x60\x60\x60';

// Pre-compute character codes for faster comparison
const SLASH_CODE = 47; // '/'
const STAR_CODE = 42; // '*'

function startsWithCodeIndicator(text: string): boolean {
  const char0 = text.charCodeAt(0);
  const char1 = text.charCodeAt(1);
  
  // Check '//' and '/*' first (most common)
  if (char0 === SLASH_CODE) {
    return char1 === SLASH_CODE || char1 === STAR_CODE;
  }
  
  // Single character checks
  switch (char0) {
    case 105: // 'i'
      return text.startsWith('import');
    case 101: // 'e'
      return text.startsWith('export');
    case 99: // 'c'
      return text.startsWith('const') || text.startsWith('class');
    case 108: // 'l'
      return text.startsWith('let');
    case 118: // 'v'
      return text.startsWith('var');
    case 102: // 'f'
      return text.startsWith('function');
    case 116: // 't'
      return text.startsWith('type');
    case 97: // 'a'
      return text.startsWith('async');
    default:
      return text.startsWith('interface');
  }
}

function lineStartsWithCode(line: string): boolean {
  // Find first non-whitespace character
  let start = 0;
  const len = line.length;
  while (start < len && (line.charCodeAt(start) === 32 || line.charCodeAt(start) === 9)) {
    start++;
  }
  
  if (start === len) return false;
  
  const char0 = line.charCodeAt(start);
  const char1 = line.charCodeAt(start + 1);
  
  // Check '//' and '/*' first
  if (char0 === SLASH_CODE) {
    return char1 === SLASH_CODE || char1 === STAR_CODE;
  }
  
  // Single character checks
  switch (char0) {
    case 105: // 'i'
      return line.startsWith('import', start) || line.startsWith('interface', start);
    case 101: // 'e'
      return line.startsWith('export', start);
    case 99: // 'c'
      return line.startsWith('const', start) || line.startsWith('class', start);
    case 108: // 'l'
      return line.startsWith('let', start);
    case 118: // 'v'
      return line.startsWith('var', start);
    case 102: // 'f'
      return line.startsWith('function', start);
    case 116: // 't'
      return line.startsWith('type', start);
    default:
      return false;
  }
}

function isValidLangTag(tag: string): boolean {
  const len = tag.length;
  if (len === 0) return true;
  
  const char0 = tag.charCodeAt(0);
  
  switch (char0) {
    case 116: case 84: // 't' or 'T'
      return (len === 2 && (tag.charCodeAt(1) | 32) === 115) || // 'ts'
             (len === 3 && (tag.charCodeAt(1) | 32) === 115 && (tag.charCodeAt(2) | 32) === 120) || // 'tsx'
             (len === 10 && (tag.toLowerCase() === 'typescript'));
    case 106: case 74: // 'j' or 'J'
      return (len === 2 && (tag.charCodeAt(1) | 32) === 115) || // 'js'
             (len === 3 && (tag.charCodeAt(1) | 32) === 115 && (tag.charCodeAt(2) | 32) === 120) || // 'jsx'
             (len === 10 && (tag.toLowerCase() === 'javascript'));
    default:
      return false;
  }
}

function extractFromCodeBlock(response: string): string | null {
  let searchStart = 0;
  const responseLen = response.length;
  
  while (searchStart < responseLen - 6) { // Need at least 6 chars for opening fence
    const fenceStart = response.indexOf(FENCE, searchStart);
    if (fenceStart === -1) {
      return null;
    }
    
    // Find the end of the opening fence line
    let lineEnd = fenceStart + 3;
    while (lineEnd < responseLen && response.charCodeAt(lineEnd) !== 10) {
      lineEnd++;
    }
    
    if (lineEnd === responseLen) {
      return null;
    }
    
    // Extract potential language tag
    const langTag = response.substring(fenceStart + 3, lineEnd).trim();
    
    // Find closing fence
    const fenceEnd = response.indexOf(FENCE, lineEnd + 1);
    if (fenceEnd === -1) {
      return null;
    }
    
    // Check if it's a valid language tag (or empty)
    if (isValidLangTag(langTag)) {
      // Extract the code between fences
      const codeStart = lineEnd + 1;
      let code = response.substring(codeStart, fenceEnd);
      
      // Trim manually for better performance
      let start = 0;
      let end = code.length;
      while (start < end && code.charCodeAt(start) <= 32) start++;
      while (end > start && code.charCodeAt(end - 1) <= 32) end--;
      
      code = code.substring(start, end);
      
      // If code is empty, try next block
      if (code.length === 0) {
        searchStart = fenceEnd + 3;
        continue;
      }
      
      return code;
    }
    
    // Not a valid lang tag, but still a code block - extract it
    const codeStart = lineEnd + 1;
    let code = response.substring(codeStart, fenceEnd);
    
    // Trim manually
    let start = 0;
    let end = code.length;
    while (start < end && code.charCodeAt(start) <= 32) start++;
    while (end > start && code.charCodeAt(end - 1) <= 32) end--;
    
    code = code.substring(start, end);
    
    if (code.length === 0) {
      searchStart = fenceEnd + 3;
      continue;
    }
    
    return code;
  }
  
  return null;
}

function extractFromProseAndCode(response: string): string | null {
  const len = response.length;
  let lineStart = 0;
  
  while (lineStart < len) {
    // Find end of current line
    let lineEnd = lineStart;
    while (lineEnd < len && response.charCodeAt(lineEnd) !== 10) {
      lineEnd++;
    }
    
    const line = response.substring(lineStart, lineEnd);
    
    if (lineStartsWithCode(line)) {
      // Return from this line to the end, trimmed
      let result = response.substring(lineStart);
      
      // Manual trim for better performance
      let start = 0;
      let end = result.length;
      while (start < end && result.charCodeAt(start) <= 32) start++;
      while (end > start && result.charCodeAt(end - 1) <= 32) end--;
      
      return result.substring(start, end);
    }
    
    lineStart = lineEnd + 1;
  }
  
  return null;
}

export function extractCode(response: string): string {
  // Handle empty/whitespace
  if (!response) {
    return '';
  }
  
  // Manual trim check
  let start = 0;
  let end = response.length;
  while (start < end && response.charCodeAt(start) <= 32) start++;
  
  if (start === end) {
    return '';
  }
  
  // Priority 1: Code blocks
  const fromBlock = extractFromCodeBlock(response);
  if (fromBlock !== null) {
    return fromBlock;
  }
  
  // Priority 2: Raw code detection
  while (end > start && response.charCodeAt(end - 1) <= 32) end--;
  const trimmed = response.substring(start, end);
  
  if (startsWithCodeIndicator(trimmed)) {
    return trimmed;
  }
  
  // Priority 3: Prose + code
  const fromProse = extractFromProseAndCode(response);
  if (fromProse !== null) {
    return fromProse;
  }
  
  // Fallback: return trimmed response
  return trimmed;
}