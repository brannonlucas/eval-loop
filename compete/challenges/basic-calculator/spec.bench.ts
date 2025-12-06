import { describe, bench } from 'vitest'
import { solution } from './solution'

describe('Basic Calculator III - Benchmarks', () => {
  // Simple expression
  bench('simple expression (10 ops)', () => {
    solution('1+2*3-4/2+5*6-7+8/2-9*1+10')
  })

  // Medium complexity with parentheses
  bench('medium with parentheses (20 ops)', () => {
    solution('(1+2)*(3+4)-(5*6)/(2+1)+(7-3)*(8/4)+((9+1)*2)')
  })

  // Deeply nested parentheses
  bench('deeply nested (10 levels)', () => {
    solution('((((((((((1+2)*3)+4)*5)+6)*7)+8)*9)+10)')
  })

  // Long expression without parentheses
  bench('long expression (50 ops)', () => {
    const parts: string[] = []
    for (let i = 1; i <= 50; i++) {
      parts.push(String(i))
    }
    solution(parts.join('+'))
  })

  // Complex mixed expression
  bench('complex mixed (30 ops)', () => {
    solution('1+2*3+4*5+6*7+8*9+10*11+(12+13)*(14-15/3)+16/4*2+(17+18-19)*20/5')
  })

  // Many parenthesized groups
  bench('many groups (15 groups)', () => {
    solution('(1+2)+(3+4)+(5+6)+(7+8)+(9+10)+(11+12)+(13+14)+(15+16)+(17+18)+(19+20)+(21+22)+(23+24)+(25+26)+(27+28)+(29+30)')
  })
})
