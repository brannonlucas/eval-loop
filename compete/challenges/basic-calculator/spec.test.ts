import { describe, it, expect } from 'vitest'
import { solution } from './solution'

describe('Basic Calculator III', () => {
  describe('Simple Operations', () => {
    it('should handle single number', () => {
      expect(solution('42')).toBe(42)
    })

    it('should handle addition', () => {
      expect(solution('1+1')).toBe(2)
      expect(solution('10+20')).toBe(30)
    })

    it('should handle subtraction', () => {
      expect(solution('5-3')).toBe(2)
      expect(solution('3-5')).toBe(-2)
    })

    it('should handle multiplication', () => {
      expect(solution('3*4')).toBe(12)
    })

    it('should handle division', () => {
      expect(solution('8/2')).toBe(4)
    })

    it('should handle division truncation toward zero', () => {
      expect(solution('7/2')).toBe(3)
      expect(solution('14/3')).toBe(4)
    })
  })

  describe('Operator Precedence', () => {
    it('should multiply before add', () => {
      expect(solution('1+2*3')).toBe(7)  // Not 9!
    })

    it('should divide before subtract', () => {
      expect(solution('14-3/2')).toBe(13)  // 14 - 1 = 13
    })

    it('should handle mixed precedence', () => {
      expect(solution('2+3*4-5')).toBe(9)  // 2 + 12 - 5 = 9
    })

    it('should handle multiple same-precedence ops left to right', () => {
      expect(solution('10-5-2')).toBe(3)  // (10-5)-2 = 3
      expect(solution('20/4/2')).toBe(2)  // (20/4)/2 = 2
    })

    it('should handle complex precedence', () => {
      expect(solution('1*2-3/4+5*6-7*8+9/10')).toBe(-24)
    })
  })

  describe('Parentheses', () => {
    it('should handle simple parentheses', () => {
      expect(solution('(1+2)')).toBe(3)
    })

    it('should override precedence with parentheses', () => {
      expect(solution('(1+2)*3')).toBe(9)
      expect(solution('2*(3+4)')).toBe(14)
    })

    it('should handle nested parentheses', () => {
      expect(solution('((1+2))')).toBe(3)
      expect(solution('((2+3)*4)')).toBe(20)
    })

    it('should handle deeply nested parentheses', () => {
      expect(solution('(((1+2)*3)+4)')).toBe(13)
    })

    it('should handle multiple parenthesized groups', () => {
      expect(solution('(1+2)+(3+4)')).toBe(10)
      expect(solution('(1+2)*(3+4)')).toBe(21)
    })

    it('should handle the LeetCode example', () => {
      expect(solution('(1+(4+5+2)-3)+(6+8)')).toBe(23)
    })
  })

  describe('Complex Expressions', () => {
    it('should handle mixed operations with parentheses', () => {
      expect(solution('2*(5+5*2)/3+(6/2+8)')).toBe(21)
    })

    it('should handle the complex LeetCode example', () => {
      expect(solution('(2+6*3+5-(3*14/7+2)*5)+3')).toBe(-12)
    })

    it('should handle expression with all operators', () => {
      expect(solution('1+2-3*4/2')).toBe(-3)  // 1 + 2 - 6 = -3
    })

    it('should handle parentheses after operator', () => {
      expect(solution('5*(2+3)')).toBe(25)
      expect(solution('10/(2+3)')).toBe(2)
    })
  })

  describe('Whitespace Handling', () => {
    it('should ignore leading/trailing spaces', () => {
      expect(solution(' 1+1 ')).toBe(2)
    })

    it('should ignore spaces between tokens', () => {
      expect(solution('1 + 1')).toBe(2)
      expect(solution(' 2-1 + 2 ')).toBe(3)
    })

    it('should handle multiple spaces', () => {
      expect(solution('1  +  2')).toBe(3)
    })

    it('should handle spaces around parentheses', () => {
      expect(solution('( 1 + 2 ) * 3')).toBe(9)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero', () => {
      expect(solution('0')).toBe(0)
      expect(solution('0+0')).toBe(0)
      expect(solution('5*0')).toBe(0)
    })

    it('should handle large numbers', () => {
      expect(solution('1000000+1')).toBe(1000001)
    })

    it('should handle result of zero from subtraction', () => {
      expect(solution('5-5')).toBe(0)
    })

    it('should handle division resulting in zero', () => {
      expect(solution('1/2')).toBe(0)
      expect(solution('3/10')).toBe(0)
    })

    it('should handle expression starting with parenthesis', () => {
      expect(solution('(1+2)*3')).toBe(9)
    })

    it('should handle consecutive operations of same type', () => {
      expect(solution('1+2+3+4+5')).toBe(15)
      expect(solution('2*3*4')).toBe(24)
    })
  })

  describe('Stress Tests', () => {
    it('should handle long expressions', () => {
      // 1+2+3+...+10 = 55
      const expr = Array.from({ length: 10 }, (_, i) => i + 1).join('+')
      expect(solution(expr)).toBe(55)
    })

    it('should handle many nested parentheses', () => {
      // ((((1+2)+3)+4)+5) = 15
      expect(solution('((((1+2)+3)+4)+5)')).toBe(15)
    })

    it('should handle alternating operations', () => {
      expect(solution('1+2*3+4*5+6*7')).toBe(69)  // 1 + 6 + 20 + 42
    })
  })
})
