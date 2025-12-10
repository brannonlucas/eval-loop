# Challenge: Code Extractor Optimizer

**YOU ARE COMPETING AGAINST OTHER AI MODELS.** This is a head-to-head competition where your solution will be benchmarked against Claude Sonnet 4, Claude Opus 4.5, and GPT-4o. The winner is determined by correctness first, then raw performance on extracting code from LLM responses.

**IMPORTANT**: A working solution is provided below. Your task is to OPTIMIZE it for maximum performance while maintaining 100% correctness. The tests are comprehensive - if you break any behavior, you lose.

## The Problem

LLMs wrap code in various formats when responding to coding prompts:
- Markdown code blocks with language tags: ` ```typescript\ncode\n``` `
- Generic code blocks: ` ```\ncode\n``` `
- Raw code without any wrapping
- Prose followed by code

Your function must extract just the code portion from any of these formats.

## Current Baseline Performance

The provided solution uses regex matching with multiple fallback strategies:
- Primary: Match typed code blocks (tsx/ts/typescript/jsx/javascript/js)
- Fallback 1: Match any code block regardless of language
- Fallback 2: Check if response starts with code indicators
- Fallback 3: Search for code-like lines after prose

## Requirements

The module must export this function:

```typescript
/**
 * Extract source code from LLM responses
 * @param response - The full LLM response text
 * @returns The extracted code (trimmed)
 */
export function extractCode(response: string): string
```

## Behavior Specifications

### Code Block Extraction
1. Find the FIRST code block in the response (position matters, not language tag)
2. Match both typed blocks (```typescript, ```ts, ```tsx, ```javascript, ```jsx, ```js) and generic blocks (```)
3. Language tags are case-insensitive when present
4. Code inside blocks should be trimmed
5. Nested code blocks (``` inside ```) should not cause issues

### Raw Code Detection
1. If no code blocks found, check if response starts with code indicators:
   - `import`, `export`, `const`, `let`, `var`, `function`, `class`, `interface`, `type`, `async`, `//`, `/*`
2. Return the trimmed response if it looks like raw code

### Prose + Code Handling
1. If prose precedes code, find the first line that looks like code
2. Return everything from that line onward
3. Code indicators for line detection: same as above (minus `async`)

### Edge Cases
1. Empty string returns empty string
2. Whitespace-only returns empty string (trimmed)
3. Multiple code blocks: return the first valid one
4. Code block with empty content: try next fallback

## Constraints

- No external dependencies
- Must be a single file with TypeScript strict mode
- Must handle all edge cases (the tests are comprehensive)

## CRITICAL - AVOID RAW BACKTICKS IN YOUR CODE

**Your response will be processed by code extraction logic that looks for \`\`\` markers.**

If you write literal triple backticks in your code (e.g., `indexOf('\`\`\`')`), it will confuse the extraction and truncate your solution!

**Instead, use one of these approaches:**
1. **Recommended**: Use a constant: `const FENCE = '\x60\x60\x60'` (hex codes for backticks)
2. **Alternative**: Build the string: `const FENCE = String.fromCharCode(96, 96, 96)`
3. **Alternative**: Use charCodeAt checks instead of string matching

Example of safe code:
```typescript
const FENCE = '\x60\x60\x60' // This is safe - uses hex escape
const idx = response.indexOf(FENCE)
```

Example of UNSAFE code that will break:
```typescript
const idx = response.indexOf('\`\`\`') // DON'T DO THIS - will truncate your solution
```

## CRITICAL - DO NOT CHANGE OUTPUT BEHAVIOR

The tests verify exact output. These behaviors MUST be preserved:
- Trimming of extracted code
- **First code block wins** - if multiple code blocks exist, return the first one found (regardless of language tag)
- Priority for detection: code blocks > raw code detection > prose+code > fallback
- Empty code blocks trigger fallback logic

## Scoring

Your solution will be scored on:
1. **Correctness** - Must pass all test cases
2. **Performance** - Ops/sec extracting code from various input sizes and formats

## Optimization Opportunities

- Replace regex with indexOf/substring for simple patterns
- Avoid split('\n') when iterating lines
- Cache compiled regex if using them
- Early return when code is found
- Minimize string allocations

## Tips

- The regex `/```(?:tsx|typescript|ts|jsx|javascript|js)?\s*\n([\s\S]*?)```/i` is expensive
- Consider using indexOf to find ``` markers, then check the language tag
- The line-by-line search in the last resort is a good optimization target
- Don't break the priority order - tests depend on it

## Previous Attempt Feedback

{{feedback}}
