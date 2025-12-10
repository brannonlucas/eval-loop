const FENCE = '\x60\x60\x60';

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

function startsWithIndicator(text: string, indicators: string[]): boolean {
  const trimmed = text.trimStart();
  return indicators.some(indicator => trimmed.startsWith(indicator));
}

function extractFromCodeBlock(response: string): string | null {
  let searchStart = 0;
  
  while (true) {
    const fenceStart = response.indexOf(FENCE, searchStart);
    if (fenceStart === -1) return null;
    
    const lineEnd = response.indexOf('\n', fenceStart + 3);
    if (lineEnd === -1) return null;
    
    const langTag = response.substring(fenceStart + 3, lineEnd).trim().toLowerCase();
    const fenceEnd = response.indexOf(FENCE, lineEnd + 1);
    if (fenceEnd === -1) return null;

    if (['tsx', 'ts', 'typescript', 'jsx', 'js', 'javascript', ''].includes(langTag)) {
      const code = response.substring(lineEnd + 1, fenceEnd).trim();
      if (code.length > 0) return code;
    }
    
    searchStart = fenceEnd + 3;
  }
}

function extractFromRawCode(response: string): string | null {
  const trimmed = response.trim();
  return trimmed && startsWithIndicator(trimmed, CODE_START_INDICATORS) ? trimmed : null;
}

function extractFromProseAndCode(response: string): string | null {
  const lines = response.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (startsWithIndicator(lines[i], LINE_INDICATORS)) {
      return response.substring(response.indexOf(lines[i])).trim();
    }
  }
  return null;
}

export function extractCode(response: string): string {
  const trimmedResponse = response.trim();
  if (!trimmedResponse) return '';
  
  const fromBlock = extractFromCodeBlock(response);
  if (fromBlock !== null) return fromBlock;

  const fromRaw = extractFromRawCode(response);
  if (fromRaw !== null) return fromRaw;

  const fromProse = extractFromProseAndCode(response);
  if (fromProse !== null) return fromProse;

  return trimmedResponse;
}