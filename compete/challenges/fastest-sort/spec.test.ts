import { describe, it, expect } from 'vitest'
import { solution } from './solution'

describe('sortArray - Correctness', () => {
  it('sorts numbers ascending', () => {
    expect(solution([3, 1, 2])).toEqual([1, 2, 3])
  })

  it('handles empty array', () => {
    expect(solution([])).toEqual([])
  })

  it('handles single element', () => {
    expect(solution([42])).toEqual([42])
  })

  it('handles duplicates', () => {
    expect(solution([1, 3, 2, 3, 1])).toEqual([1, 1, 2, 3, 3])
  })

  it('handles negative numbers', () => {
    expect(solution([-5, 3, -2, 0, 1])).toEqual([-5, -2, 0, 1, 3])
  })

  it('handles already sorted array', () => {
    expect(solution([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5])
  })

  it('handles reverse sorted array', () => {
    expect(solution([5, 4, 3, 2, 1])).toEqual([1, 2, 3, 4, 5])
  })

  it('does not mutate input array', () => {
    const input = [3, 1, 2]
    const inputCopy = [...input]
    solution(input)
    expect(input).toEqual(inputCopy)
  })

  it('handles large numbers', () => {
    expect(solution([1000000, 1, 999999])).toEqual([1, 999999, 1000000])
  })

  it('handles floating point numbers', () => {
    expect(solution([3.14, 2.71, 1.41])).toEqual([1.41, 2.71, 3.14])
  })
})
