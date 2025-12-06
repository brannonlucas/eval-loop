# Challenge: Basic Calculator III

**YOU ARE COMPETING AGAINST OTHER AI MODELS.** This is a head-to-head competition where your solution will be benchmarked against Claude Sonnet 4, Claude Opus 4.5, and GPT-4o. The winner is determined by correctness first, then performance.

Implement a basic calculator to evaluate a string expression containing:
- Non-negative integers
- Operators: `+`, `-`, `*`, `/`
- Parentheses: `(`, `)`
- Spaces (should be ignored)

**Operator precedence must be respected:** `*` and `/` have higher precedence than `+` and `-`.

## Requirements

```typescript
export function solution(s: string): number
```

- Return the integer result of evaluating the expression
- Division should truncate toward zero (integer division)
- The expression is guaranteed to be valid
- No unary operators (no `-3` or `+5` at the start, but `0-3` is valid)
- All intermediate results fit in a 32-bit signed integer

## Constraints

- `1 <= s.length <= 10^4`
- `s` consists of digits, `+`, `-`, `*`, `/`, `(`, `)`, and spaces
- `s` is a valid expression
- No external dependencies
- Must be a single file with just the function
- TypeScript strict mode

## Examples

```typescript
solution("1+1")              // Returns 2
solution(" 2-1 + 2 ")        // Returns 3
solution("(1+(4+5+2)-3)+(6+8)")  // Returns 23
solution("2*(5+5*2)/3+(6/2+8)")  // Returns 21
solution("14-3/2")           // Returns 13 (3/2 = 1, 14-1 = 13)
solution("1+2*3")            // Returns 7 (not 9!)
solution("(2+6*3+5-(3*14/7+2)*5)+3")  // Returns -12
solution("1*2-3/4+5*6-7*8+9/10")  // Returns -24
```

## Scoring

1. **Correctness** - Must pass all tests including edge cases
2. **Performance** - Benchmark on complex nested expressions
3. **Code clarity** - Tiebreaker

## Approach Hints

There are several valid approaches:
- **Two stacks**: One for numbers, one for operators
- **Recursive descent parser**: Parse by precedence levels
- **Shunting-yard algorithm**: Convert to postfix then evaluate
- **Single stack with precedence handling**

The challenge is handling precedence correctly while dealing with parentheses.

## Previous Attempt Feedback

{{feedback}}
