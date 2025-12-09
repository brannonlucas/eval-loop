/**
 * Challenge Scaffold Generator
 *
 * Creates new challenge directories with template files
 * for function or React component challenges.
 */

import { mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export type ChallengeTemplate = 'function' | 'react'

interface ScaffoldOptions {
  name: string
  type: ChallengeTemplate
  basePath?: string
}

const FUNCTION_PROMPT = `# Challenge: {{NAME}}

Write a TypeScript function that solves the following problem.

## Requirements

- Export a function named \`solution\`
- [Add your specific requirements here]
- Handle edge cases appropriately

## Function Signature

\`\`\`typescript
export function solution(input: unknown): unknown
\`\`\`

## Examples

\`\`\`typescript
solution(/* input */) // returns /* expected output */
\`\`\`

## Constraints

- [Add any constraints, e.g., time complexity, input size limits]

## Scoring

Solutions are ranked by:
1. Correctness (must pass all tests)
2. Performance (operations per second)

## Previous Feedback

{{feedback}}
`

const FUNCTION_TEST = `import { describe, it, expect } from 'vitest'
import { solution } from './solution'

describe('{{NAME}}', () => {
  it('should handle basic case', () => {
    // TODO: Add your test cases
    expect(solution(/* input */)).toBe(/* expected */)
  })

  it('should handle edge cases', () => {
    // TODO: Add edge case tests
  })

  it('should handle empty input', () => {
    // TODO: Add empty/null input handling
  })
})
`

const FUNCTION_BENCH = `import { describe, bench } from 'vitest'
import { solution } from './solution'

describe('{{NAME}} benchmarks', () => {
  // TODO: Prepare test data
  // const testData = ...

  bench('solution', () => {
    // TODO: Call solution with test data
    // solution(testData)
  })
})
`

const FUNCTION_SOLUTION = `/**
 * {{NAME}} - Solution placeholder
 *
 * This file will be overwritten by AI-generated solutions.
 * You can use this as a reference implementation.
 */

export function solution(input: unknown): unknown {
  // TODO: Implement your reference solution
  throw new Error('Not implemented')
}
`

const REACT_PROMPT = `# Challenge: {{NAME}}

Build a React component that meets the following requirements.

## Requirements

- Export a default React component
- [Add your specific requirements here]
- Component should be performant with large datasets

## Component Props

\`\`\`typescript
interface Props {
  // Define your props
}
\`\`\`

## Examples

\`\`\`tsx
<{{NAME}} /* props */ />
\`\`\`

## Performance Goals

- Maintain 60 FPS during scrolling/interaction
- Minimize unnecessary re-renders
- Keep bundle size reasonable

## Scoring

Solutions are ranked by:
1. Correctness (must pass all tests)
2. Performance score (FPS, render count, bundle size)

## Previous Feedback

{{feedback}}
`

const REACT_TEST = `import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Solution from './solution'

describe('{{NAME}}', () => {
  it('should render without crashing', () => {
    render(<Solution />)
    // TODO: Add assertions
  })

  it('should display expected content', () => {
    render(<Solution />)
    // TODO: Add content assertions
    // expect(screen.getByText('...')).toBeInTheDocument()
  })

  it('should handle user interaction', () => {
    render(<Solution />)
    // TODO: Add interaction tests
  })
})
`

const REACT_SOLUTION = `/**
 * {{NAME}} - Solution placeholder
 *
 * This file will be overwritten by AI-generated solutions.
 * You can use this as a reference implementation.
 */

export default function Solution() {
  // TODO: Implement your reference solution
  return (
    <div>
      <p>{{NAME}} - Not implemented</p>
    </div>
  )
}
`

const CONFIG_TEMPLATE = `{
  "type": "{{TYPE}}",
  "name": "{{NAME}}",
  "generationTimeout": {{TIMEOUT}},
  "maxRetries": 3
}
`

function replaceTemplateVars(template: string, name: string, type: ChallengeTemplate): string {
  const displayName = name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')

  return template
    .replace(/\{\{NAME\}\}/g, displayName)
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{TYPE\}\}/g, type === 'react' ? 'react-component' : 'function')
    .replace(/\{\{TIMEOUT\}\}/g, type === 'react' ? '90000' : '60000')
}

export async function scaffoldChallenge(options: ScaffoldOptions): Promise<void> {
  const { name, type, basePath = join(process.cwd(), 'compete/challenges') } = options
  const challengePath = join(basePath, name)

  // Check if challenge already exists
  if (existsSync(challengePath)) {
    throw new Error(`Challenge '${name}' already exists at ${challengePath}`)
  }

  // Create directory
  await mkdir(challengePath, { recursive: true })

  const ext = type === 'react' ? 'tsx' : 'ts'

  // Select templates based on type
  const promptTemplate = type === 'react' ? REACT_PROMPT : FUNCTION_PROMPT
  const testTemplate = type === 'react' ? REACT_TEST : FUNCTION_TEST
  const solutionTemplate = type === 'react' ? REACT_SOLUTION : FUNCTION_SOLUTION

  // Write files
  const files = [
    { name: 'prompt.md', content: replaceTemplateVars(promptTemplate, name, type) },
    { name: `spec.test.${ext}`, content: replaceTemplateVars(testTemplate, name, type) },
    { name: `solution.${ext}`, content: replaceTemplateVars(solutionTemplate, name, type) },
    { name: 'challenge.config.json', content: replaceTemplateVars(CONFIG_TEMPLATE, name, type) },
  ]

  // Add benchmark file for function challenges
  if (type === 'function') {
    files.push({
      name: 'spec.bench.ts',
      content: replaceTemplateVars(FUNCTION_BENCH, name, type),
    })
  }

  for (const file of files) {
    await writeFile(join(challengePath, file.name), file.content)
  }

  console.log(`\nCreated challenge '${name}' at ${challengePath}`)
  console.log('\nFiles created:')
  for (const file of files) {
    console.log(`  - ${file.name}`)
  }
  console.log('\nNext steps:')
  console.log('  1. Edit prompt.md with your challenge description')
  console.log(`  2. Add test cases to spec.test.${ext}`)
  if (type === 'function') {
    console.log('  3. Configure benchmarks in spec.bench.ts')
  }
  console.log(`  4. Run: bun run compete -c ${name}`)
}
