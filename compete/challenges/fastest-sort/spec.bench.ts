import { describe, bench } from 'vitest'
import { solution } from './solution'

// Generate test data
function randomArray(size: number): number[] {
  return Array.from({ length: size }, () => Math.random() * 10000)
}

function sortedArray(size: number): number[] {
  return Array.from({ length: size }, (_, i) => i)
}

function reverseSortedArray(size: number): number[] {
  return Array.from({ length: size }, (_, i) => size - i)
}

describe('sortArray - Benchmarks', () => {
  // Small array
  bench('sort 1k items (random)', () => {
    solution(randomArray(1000))
  })

  // Medium array
  bench('sort 10k items (random)', () => {
    solution(randomArray(10000))
  })

  // Large array
  bench('sort 100k items (random)', () => {
    solution(randomArray(100000))
  })

  // Best case - already sorted
  bench('sort 10k items (already sorted)', () => {
    solution(sortedArray(10000))
  })

  // Worst case - reverse sorted
  bench('sort 10k items (reverse sorted)', () => {
    solution(reverseSortedArray(10000))
  })
})
