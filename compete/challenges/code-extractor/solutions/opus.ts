// Use hex codes to avoid backtick issues in extraction
const FENCE = '\x60\x60\x60';

// Pre-compute code indicators for raw code detection
const CODE_START_INDICATORS = [
  'import',
  'export',
  'const',
  'let',
  'var',
  'function',
  'class',
  'interface',
  'type',
  'async',
  '//',
  '/*'
];

// Line indicators (without async)
const LINE_INDICATORS = [
  'import',
  'export',
  'const',
  'let',
  'var',
  'function',
  'class',
  'interface',
  'type',
  '//',
  '/*'
];

function startsWithCodeIndicator(text: string): boolean {
  for (let i = 0; i < CODE_START_INDICATORS.length; i++) {
    if (text.startsWith(CODE_START_INDICATORS[i])) {
      return true;
    }
  }
  return false;
}

function lineStartsWithCode(line: string): boolean {
  const trimmed = line.trimStart();
  for (let i = 0; i < LINE_INDICATORS.length; i++) {
    if (trimmed.startsWith(LINE_INDICATORS[i])) {
      return true;
    }
  }
  return false;
}

function isValidLangTag(tag: string): boolean {
  const lower = tag.toLowerCase();
  return (
    lower === '' ||
    lower === 'tsx' ||
    lower === 'ts' ||
    lower === 'typescript' ||
    lower === 'jsx' ||
    lower === 'js' ||
    lower === 'javascript'
  );
}

function extractFromCodeBlock(response: string): string | null {
  let searchStart = 0;
  
  while (true) {
    const fenceStart = response.indexOf(FENCE, searchStart);
    if (fenceStart === -1) {
      return null;
    }
    
    // Find the end of the opening fence line
    let lineEnd = response.indexOf('\n', fenceStart + 3);
    if (lineEnd === -1) {
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
      const code = response.substring(lineEnd + 1, fenceEnd).trim();
      
      // If code is empty, try next block
      if (code.length === 0) {
        searchStart = fenceEnd + 3;
        continue;
      }
      
      return code;
    }
    
    // Not a valid lang tag, but still a code block - extract it
    // (generic code blocks should be matched)
    const code = response.substring(lineEnd + 1, fenceEnd).trim();
    
    if (code.length === 0) {
      searchStart = fenceEnd + 3;
      continue;
    }
    
    return code;
  }
}

function extractFromRawCode(response: string): string | null {
  const trimmed = response.trim();
  if (trimmed.length === 0) {
    return null;
  }
  
  if (startsWithCodeIndicator(trimmed)) {
    return trimmed;
  }
  
  return null;
}

function extractFromProseAndCode(response: string): string | null {
  const len = response.length;
  let lineStart = 0;
  
  while (lineStart < len) {
    // Find end of current line
    let lineEnd = response.indexOf('\n', lineStart);
    if (lineEnd === -1) {
      lineEnd = len;
    }
    
    const line = response.substring(lineStart, lineEnd);
    
    if (lineStartsWithCode(line)) {
      // Return from this line to the end, trimmed
      return response.substring(lineStart).trim();
    }
    
    lineStart = lineEnd + 1;
  }
  
  return null;
}

export function extractCode(response: string): string {
  // Handle empty/whitespace
  if (!response || response.trim().length === 0) {
    return '';
  }
  
  // Priority 1: Code blocks
  const fromBlock = extractFromCodeBlock(response);
  if (fromBlock !== null) {
    return fromBlock;
  }
  
  // Priority 2: Raw code detection
  const fromRaw = extractFromRawCode(response);
  if (fromRaw !== null) {
    return fromRaw;
  }
  
  // Priority 3: Prose + code
  const fromProse = extractFromProseAndCode(response);
  if (fromProse !== null) {
    return fromProse;
  }
  
  // Fallback: return trimmed response
  return response.trim();
}