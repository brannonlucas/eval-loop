import { describe, bench } from 'vitest'
import { extractCode } from './solution'

// ═══════════════════════════════════════════════════════════════════════════
// Test Data Generation
// ═══════════════════════════════════════════════════════════════════════════

function generateTypedCodeBlock(lines: number): string {
  const code = Array.from({ length: lines }, (_, i) => `  const line${i} = ${i}`).join('\n')
  return `Here's the implementation:

\`\`\`typescript
export function generated() {
${code}
  return line0
}
\`\`\`

This function does something useful.`
}

function generateGenericCodeBlock(lines: number): string {
  const code = Array.from({ length: lines }, (_, i) => `const item${i} = ${i}`).join('\n')
  return `\`\`\`
${code}
\`\`\``
}

function generateRawCode(lines: number): string {
  const imports = `import { useState, useEffect } from 'react'\nimport { api } from './api'\n\n`
  const code = Array.from({ length: lines }, (_, i) => `const value${i} = ${i}`).join('\n')
  return imports + code
}

function generateProseWithCode(proseLines: number, codeLines: number): string {
  const prose = Array.from({ length: proseLines }, (_, i) => `This is explanation line ${i}.`).join('\n')
  const code = Array.from({ length: codeLines }, (_, i) => `const result${i} = ${i}`).join('\n')
  return `${prose}

import { something } from 'somewhere'

${code}`
}

function generateClaudeStyleResponse(codeLines: number): string {
  const code = Array.from({ length: codeLines }, (_, i) => `  const step${i} = process(${i})`).join('\n')
  return `I'll help you implement this. Here's a solution that handles all the edge cases:

\`\`\`typescript
export interface Config {
  timeout: number
  retries: number
}

export async function processData(input: string[], config: Config): Promise<string[]> {
${code}
  return input.map(x => x.toUpperCase())
}
\`\`\`

This implementation:
1. Takes an array of strings
2. Processes each one
3. Returns the results

Let me know if you need any modifications!`
}

function generateGPTStyleResponse(codeLines: number): string {
  const code = Array.from({ length: codeLines }, (_, i) => `    arr[${i}] = transform(arr[${i}])`).join('\n')
  return `## Solution

Here's an optimized implementation:

\`\`\`javascript
function processArray(arr) {
  const n = arr.length
  for (let i = 0; i < n; i++) {
${code}
  }
  return arr
}

module.exports = { processArray }
\`\`\`

### Time Complexity
O(n) where n is the length of the input array.

### Space Complexity
O(1) - we modify the array in place.

### Example Usage
\`\`\`javascript
const result = processArray([1, 2, 3])
console.log(result)
\`\`\``
}

// Pre-generated test inputs of various sizes
const smallTypedBlock = generateTypedCodeBlock(10)
const mediumTypedBlock = generateTypedCodeBlock(100)
const largeTypedBlock = generateTypedCodeBlock(500)

const smallGenericBlock = generateGenericCodeBlock(10)
const mediumGenericBlock = generateGenericCodeBlock(100)
const largeGenericBlock = generateGenericCodeBlock(500)

const smallRawCode = generateRawCode(10)
const mediumRawCode = generateRawCode(100)
const largeRawCode = generateRawCode(500)

const smallProseWithCode = generateProseWithCode(5, 10)
const mediumProseWithCode = generateProseWithCode(20, 50)
const largeProseWithCode = generateProseWithCode(50, 200)

const smallClaudeResponse = generateClaudeStyleResponse(10)
const mediumClaudeResponse = generateClaudeStyleResponse(50)
const largeClaudeResponse = generateClaudeStyleResponse(200)

const smallGPTResponse = generateGPTStyleResponse(10)
const mediumGPTResponse = generateGPTStyleResponse(50)
const largeGPTResponse = generateGPTStyleResponse(200)

// ═══════════════════════════════════════════════════════════════════════════
// Benchmarks
// ═══════════════════════════════════════════════════════════════════════════

describe('extractCode - Typed Code Blocks', () => {
  bench('small typed block (10 lines)', () => {
    extractCode(smallTypedBlock)
  })

  bench('medium typed block (100 lines)', () => {
    extractCode(mediumTypedBlock)
  })

  bench('large typed block (500 lines)', () => {
    extractCode(largeTypedBlock)
  })
})

describe('extractCode - Generic Code Blocks', () => {
  bench('small generic block (10 lines)', () => {
    extractCode(smallGenericBlock)
  })

  bench('medium generic block (100 lines)', () => {
    extractCode(mediumGenericBlock)
  })

  bench('large generic block (500 lines)', () => {
    extractCode(largeGenericBlock)
  })
})

describe('extractCode - Raw Code Detection', () => {
  bench('small raw code (10 lines)', () => {
    extractCode(smallRawCode)
  })

  bench('medium raw code (100 lines)', () => {
    extractCode(mediumRawCode)
  })

  bench('large raw code (500 lines)', () => {
    extractCode(largeRawCode)
  })
})

describe('extractCode - Prose + Code', () => {
  bench('small prose + code', () => {
    extractCode(smallProseWithCode)
  })

  bench('medium prose + code', () => {
    extractCode(mediumProseWithCode)
  })

  bench('large prose + code', () => {
    extractCode(largeProseWithCode)
  })
})

describe('extractCode - Real LLM Responses', () => {
  bench('small Claude-style response', () => {
    extractCode(smallClaudeResponse)
  })

  bench('medium Claude-style response', () => {
    extractCode(mediumClaudeResponse)
  })

  bench('large Claude-style response', () => {
    extractCode(largeClaudeResponse)
  })

  bench('small GPT-style response', () => {
    extractCode(smallGPTResponse)
  })

  bench('medium GPT-style response', () => {
    extractCode(mediumGPTResponse)
  })

  bench('large GPT-style response', () => {
    extractCode(largeGPTResponse)
  })
})

describe('extractCode - Edge Cases', () => {
  bench('empty string', () => {
    extractCode('')
  })

  bench('whitespace only', () => {
    extractCode('   \n\t\n   ')
  })

  bench('plain text (no code)', () => {
    extractCode('This is just some text without any code blocks or code indicators.')
  })

  bench('single line code', () => {
    extractCode('```typescript\nconst x = 1\n```')
  })
})
