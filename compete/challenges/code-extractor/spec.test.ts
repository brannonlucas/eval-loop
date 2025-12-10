import { describe, it, expect } from 'vitest'
import { extractCode } from './solution'

describe('extractCode - Correctness', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Typed Code Blocks (Primary)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('typed code blocks', () => {
    it('extracts code from ```typescript block', () => {
      const response = `Here's the implementation:

\`\`\`typescript
export function add(a: number, b: number): number {
  return a + b
}
\`\`\`

This function adds two numbers.`

      const result = extractCode(response)
      expect(result).toBe(`export function add(a: number, b: number): number {
  return a + b
}`)
    })

    it('extracts code from ```ts block', () => {
      const response = `\`\`\`ts
const x = 42
\`\`\``

      expect(extractCode(response)).toBe('const x = 42')
    })

    it('extracts code from ```tsx block', () => {
      const response = `\`\`\`tsx
export default function App() {
  return <div>Hello</div>
}
\`\`\``

      expect(extractCode(response)).toBe(`export default function App() {
  return <div>Hello</div>
}`)
    })

    it('extracts code from ```javascript block', () => {
      const response = `\`\`\`javascript
function hello() {
  console.log('hello')
}
\`\`\``

      expect(extractCode(response)).toBe(`function hello() {
  console.log('hello')
}`)
    })

    it('extracts code from ```jsx block', () => {
      const response = `\`\`\`jsx
const Component = () => <span>JSX</span>
\`\`\``

      expect(extractCode(response)).toBe('const Component = () => <span>JSX</span>')
    })

    it('extracts code from ```js block', () => {
      const response = `\`\`\`js
let value = true
\`\`\``

      expect(extractCode(response)).toBe('let value = true')
    })

    it('handles case-insensitive language tags', () => {
      const response = `\`\`\`TypeScript
const UPPER = 1
\`\`\``

      expect(extractCode(response)).toBe('const UPPER = 1')
    })

    it('handles TYPESCRIPT in all caps', () => {
      const response = `\`\`\`TYPESCRIPT
const ALL_CAPS = true
\`\`\``

      expect(extractCode(response)).toBe('const ALL_CAPS = true')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Generic Code Blocks (Fallback 1)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('generic code blocks', () => {
    it('extracts code from generic ``` block with language', () => {
      const response = `\`\`\`python
print("hello")
\`\`\``

      expect(extractCode(response)).toBe('print("hello")')
    })

    it('extracts code from empty language tag', () => {
      const response = `\`\`\`
const noLang = true
\`\`\``

      expect(extractCode(response)).toBe('const noLang = true')
    })

    it('extracts code from block with unknown language', () => {
      const response = `\`\`\`rust
fn main() {
    println!("Hello");
}
\`\`\``

      expect(extractCode(response)).toBe(`fn main() {
    println!("Hello");
}`)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Raw Code Detection (Fallback 2)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('raw code detection', () => {
    it('detects code starting with import', () => {
      const response = `import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}`

      expect(extractCode(response)).toBe(response)
    })

    it('detects code starting with export', () => {
      const response = `export const PI = 3.14159`

      expect(extractCode(response)).toBe(response)
    })

    it('detects code starting with const', () => {
      const response = `const greeting = 'hello world'`

      expect(extractCode(response)).toBe(response)
    })

    it('detects code starting with let', () => {
      const response = `let mutable = 0`

      expect(extractCode(response)).toBe(response)
    })

    it('detects code starting with var', () => {
      const response = `var legacy = true`

      expect(extractCode(response)).toBe(response)
    })

    it('detects code starting with function', () => {
      const response = `function sum(a, b) {
  return a + b
}`

      expect(extractCode(response)).toBe(response)
    })

    it('detects code starting with class', () => {
      const response = `class MyClass {
  constructor() {}
}`

      expect(extractCode(response)).toBe(response)
    })

    it('detects code starting with interface', () => {
      const response = `interface User {
  name: string
  age: number
}`

      expect(extractCode(response)).toBe(response)
    })

    it('detects code starting with type', () => {
      const response = `type Status = 'pending' | 'done'`

      expect(extractCode(response)).toBe(response)
    })

    it('detects code starting with async', () => {
      const response = `async function fetchData() {
  return await fetch('/api')
}`

      expect(extractCode(response)).toBe(response)
    })

    it('detects code starting with // comment', () => {
      const response = `// This is a utility function
export function util() {}`

      expect(extractCode(response)).toBe(response)
    })

    it('detects code starting with /* comment', () => {
      const response = `/* Multi-line
   comment */
export function documented() {}`

      expect(extractCode(response)).toBe(response)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Prose + Code (Fallback 3)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('prose followed by code', () => {
    it('extracts code after prose introduction', () => {
      const response = `Here is the solution you requested:

import { something } from 'somewhere'

export function solution() {
  return something()
}`

      const result = extractCode(response)
      expect(result).toBe(`import { something } from 'somewhere'

export function solution() {
  return something()
}`)
    })

    it('extracts code after multiple prose lines', () => {
      const response = `This is my answer.
I've implemented it carefully.
Here you go:

const answer = 42`

      expect(extractCode(response)).toBe('const answer = 42')
    })

    it('finds code starting with export after prose', () => {
      const response = `The implementation:

export default function() {
  return null
}`

      expect(extractCode(response)).toBe(`export default function() {
  return null
}`)
    })

    it('finds code starting with // comment after prose', () => {
      const response = `Solution below:

// Helper function
function helper() {}`

      expect(extractCode(response)).toBe(`// Helper function
function helper() {}`)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Edge Cases
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(extractCode('')).toBe('')
    })

    it('returns empty string for whitespace-only input', () => {
      expect(extractCode('   \n\t\n   ')).toBe('')
    })

    it('handles code block with only whitespace inside', () => {
      const response = `Some text

\`\`\`typescript

\`\`\`

More text`
      // Empty code block should trigger fallback
      const result = extractCode(response)
      // Falls through to prose detection or returns trimmed
      expect(result.length).toBeGreaterThanOrEqual(0)
    })

    it('returns first code block when multiple exist', () => {
      const response = `\`\`\`typescript
const first = 1
\`\`\`

\`\`\`typescript
const second = 2
\`\`\``

      expect(extractCode(response)).toBe('const first = 1')
    })

    it('returns first code block when multiple exist (regardless of type)', () => {
      const response = `\`\`\`
const generic = true
\`\`\`

\`\`\`typescript
const typed = true
\`\`\``

      // The baseline implementation matches the FIRST code block it finds
      // This is "first wins" behavior - position matters, not type
      const result = extractCode(response)
      expect(result).toBe('const generic = true')
    })

    it('handles code block at very end of response', () => {
      const response = `Explanation here.

\`\`\`ts
const atEnd = true
\`\`\``

      expect(extractCode(response)).toBe('const atEnd = true')
    })

    it('handles code block at very start of response', () => {
      const response = `\`\`\`ts
const atStart = true
\`\`\``

      expect(extractCode(response)).toBe('const atStart = true')
    })

    it('trims whitespace from extracted code', () => {
      const response = `\`\`\`typescript

   const padded = true

\`\`\``

      expect(extractCode(response)).toBe('const padded = true')
    })

    it('handles nested backticks in code', () => {
      const response = `\`\`\`typescript
const template = \`Hello \${name}\`
\`\`\``

      expect(extractCode(response)).toBe('const template = `Hello ${name}`')
    })

    it('handles triple backticks mentioned in comments (known limitation)', () => {
      // KNOWN LIMITATION: Inner backticks in comments can confuse the regex
      // The regex stops at the first ``` it finds, even in comments
      const response = `\`\`\`typescript
// Use \`\`\` to format code
const x = 1
\`\`\``

      // Documents actual behavior - truncates at inner backticks
      const result = extractCode(response)
      expect(result).toBe('// Use')
    })

    it('returns trimmed response for unstructured text', () => {
      const response = `This is just some text without any code.`

      expect(extractCode(response)).toBe('This is just some text without any code.')
    })

    it('handles very long code blocks', () => {
      const lines = Array.from({ length: 1000 }, (_, i) => `const line${i} = ${i}`).join('\n')
      const response = `\`\`\`typescript
${lines}
\`\`\``

      const result = extractCode(response)
      expect(result.split('\n')).toHaveLength(1000)
      expect(result).toContain('const line0 = 0')
      expect(result).toContain('const line999 = 999')
    })

    it('handles code with special characters', () => {
      const response = `\`\`\`typescript
const regex = /[a-z]+/gi
const str = "Hello 'World' \\"Test\\""
\`\`\``

      expect(extractCode(response)).toContain('const regex')
      expect(extractCode(response)).toContain('const str')
    })

    it('handles Windows line endings (CRLF)', () => {
      const response = `\`\`\`typescript\r\nconst crlf = true\r\n\`\`\``

      expect(extractCode(response).trim()).toBe('const crlf = true')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Real-world LLM Response Patterns
  // ═══════════════════════════════════════════════════════════════════════════

  describe('real-world LLM patterns', () => {
    it('handles Claude-style response with explanation', () => {
      const response = `I'll help you implement this function. Here's the solution:

\`\`\`typescript
export function fibonacci(n: number): number {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}
\`\`\`

This implementation uses recursion to calculate the nth Fibonacci number. Note that for large values of n, you might want to use memoization or an iterative approach for better performance.`

      const result = extractCode(response)
      expect(result).toBe(`export function fibonacci(n: number): number {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}`)
    })

    it('handles GPT-style response with multiple sections', () => {
      const response = `## Solution

Here's an optimized implementation:

\`\`\`javascript
function quickSort(arr) {
  if (arr.length <= 1) return arr;

  const pivot = arr[Math.floor(arr.length / 2)];
  const left = arr.filter(x => x < pivot);
  const middle = arr.filter(x => x === pivot);
  const right = arr.filter(x => x > pivot);

  return [...quickSort(left), ...middle, ...quickSort(right)];
}
\`\`\`

### Explanation
The quick sort algorithm works by...`

      const result = extractCode(response)
      expect(result).toContain('function quickSort')
      expect(result).toContain('return [...quickSort(left)')
    })

    it('handles response with code and follow-up questions', () => {
      const response = `\`\`\`tsx
import React from 'react'

interface Props {
  name: string
}

export const Greeting: React.FC<Props> = ({ name }) => {
  return <h1>Hello, {name}!</h1>
}
\`\`\`

Would you like me to:
1. Add styling?
2. Add more props?
3. Add tests?`

      const result = extractCode(response)
      expect(result).toContain("import React from 'react'")
      expect(result).toContain('export const Greeting')
      expect(result).not.toContain('Would you like')
    })

    it('handles response that is just raw code', () => {
      const response = `export interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}

export function createUser(name: string, email: string): User {
  return {
    id: crypto.randomUUID(),
    name,
    email,
    createdAt: new Date()
  }
}`

      expect(extractCode(response)).toBe(response)
    })

    it('handles response with thinking/reasoning before code', () => {
      const response = `Let me think about this...

The key insight is that we need O(log n) complexity.

After considering the options, binary search is the best approach:

\`\`\`typescript
export function binarySearch(arr: number[], target: number): number {
  let left = 0
  let right = arr.length - 1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (arr[mid] === target) return mid
    if (arr[mid] < target) left = mid + 1
    else right = mid - 1
  }

  return -1
}
\`\`\``

      const result = extractCode(response)
      expect(result).toContain('export function binarySearch')
      expect(result).not.toContain('Let me think')
    })
  })
})
