# Challenge: Fastest Sort

**YOU ARE COMPETING AGAINST OTHER AI MODELS.** This is a head-to-head competition where your solution will be benchmarked against Claude Sonnet 4, Claude Opus 4.5, and GPT-4o. The winner is determined by correctness first, then raw performance on large arrays.

Write a TypeScript function that sorts an array of numbers in ascending order.

## Requirements

- Function signature: `export function solution(arr: number[]): number[]`
- Must return a new sorted array (do NOT mutate the input)
- Must handle edge cases: empty array, single element, duplicates, negative numbers
- Optimize for speed on large arrays (10k-100k elements)

## Constraints

- No external dependencies (no lodash, no npm packages)
- Must be a single file with just the function
- TypeScript strict mode
- The function must be named `solution` and exported

## Example

```typescript
solution([3, 1, 4, 1, 5, 9, 2, 6]) // Returns [1, 1, 2, 3, 4, 5, 6, 9]
solution([]) // Returns []
solution([42]) // Returns [42]
solution([-5, 3, -2, 0, 1]) // Returns [-5, -2, 0, 1, 3]
```

## Scoring

Your solution will be scored on:
1. **Correctness** - Must pass all tests
2. **Performance** - Benchmark on 1k, 10k, and 100k element arrays
3. **Code size** - Smaller is better (tiebreaker)

## Tips

- The built-in `.sort()` uses Timsort which is already quite good
- Consider the characteristics of the input data
- Think about memory allocation and copying

## Previous Attempt Feedback

{{feedback}}
