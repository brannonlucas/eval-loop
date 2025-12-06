import { describe, it, expect } from 'vitest'
import { LRUCache } from './solution'

describe('LRUCache', () => {
  describe('Basic Operations', () => {
    it('should store and retrieve a single value', () => {
      const cache = new LRUCache(1)
      cache.put(1, 100)
      expect(cache.get(1)).toBe(100)
    })

    it('should return -1 for missing keys', () => {
      const cache = new LRUCache(2)
      expect(cache.get(1)).toBe(-1)
      cache.put(1, 1)
      expect(cache.get(2)).toBe(-1)
    })

    it('should update existing keys', () => {
      const cache = new LRUCache(2)
      cache.put(1, 1)
      cache.put(1, 10)
      expect(cache.get(1)).toBe(10)
    })

    it('should handle capacity of 1', () => {
      const cache = new LRUCache(1)
      cache.put(1, 1)
      cache.put(2, 2)
      expect(cache.get(1)).toBe(-1)
      expect(cache.get(2)).toBe(2)
    })
  })

  describe('LRU Eviction', () => {
    it('should evict least recently used on capacity overflow', () => {
      const cache = new LRUCache(2)
      cache.put(1, 1)
      cache.put(2, 2)
      cache.put(3, 3) // evicts key 1
      expect(cache.get(1)).toBe(-1)
      expect(cache.get(2)).toBe(2)
      expect(cache.get(3)).toBe(3)
    })

    it('should update recency on get', () => {
      const cache = new LRUCache(2)
      cache.put(1, 1)
      cache.put(2, 2)
      cache.get(1) // makes 1 recently used
      cache.put(3, 3) // should evict 2, not 1
      expect(cache.get(1)).toBe(1)
      expect(cache.get(2)).toBe(-1)
      expect(cache.get(3)).toBe(3)
    })

    it('should update recency on put (existing key)', () => {
      const cache = new LRUCache(2)
      cache.put(1, 1)
      cache.put(2, 2)
      cache.put(1, 10) // updates 1, makes it recently used
      cache.put(3, 3) // should evict 2, not 1
      expect(cache.get(1)).toBe(10)
      expect(cache.get(2)).toBe(-1)
      expect(cache.get(3)).toBe(3)
    })

    it('should handle the LeetCode example', () => {
      const cache = new LRUCache(2)
      cache.put(1, 1)
      cache.put(2, 2)
      expect(cache.get(1)).toBe(1)
      cache.put(3, 3)
      expect(cache.get(2)).toBe(-1)
      cache.put(4, 4)
      expect(cache.get(1)).toBe(-1)
      expect(cache.get(3)).toBe(3)
      expect(cache.get(4)).toBe(4)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero values', () => {
      const cache = new LRUCache(2)
      cache.put(1, 0)
      expect(cache.get(1)).toBe(0)
    })

    it('should handle large keys', () => {
      const cache = new LRUCache(2)
      cache.put(1000000, 1)
      expect(cache.get(1000000)).toBe(1)
    })

    it('should handle large values', () => {
      const cache = new LRUCache(2)
      cache.put(1, 1000000)
      expect(cache.get(1)).toBe(1000000)
    })

    it('should handle many operations without growing memory', () => {
      const cache = new LRUCache(100)
      for (let i = 0; i < 10000; i++) {
        cache.put(i % 200, i)
      }
      // Should still work correctly
      expect(cache.get(9999 % 200)).toBe(9999)
    })

    it('should handle alternating get/put patterns', () => {
      const cache = new LRUCache(3)
      cache.put(1, 1)
      cache.put(2, 2)
      cache.put(3, 3)
      expect(cache.get(1)).toBe(1)
      cache.put(4, 4) // evicts 2
      expect(cache.get(2)).toBe(-1)
      expect(cache.get(3)).toBe(3)
      cache.put(5, 5) // evicts 1
      expect(cache.get(1)).toBe(-1)
    })
  })

  describe('Stress Tests', () => {
    it('should handle rapid sequential access', () => {
      const cache = new LRUCache(1000)
      // Fill cache
      for (let i = 0; i < 1000; i++) {
        cache.put(i, i * 2)
      }
      // Verify all values
      for (let i = 0; i < 1000; i++) {
        expect(cache.get(i)).toBe(i * 2)
      }
    })

    it('should correctly evict in FIFO order when no gets', () => {
      const cache = new LRUCache(3)
      cache.put(1, 1)
      cache.put(2, 2)
      cache.put(3, 3)
      cache.put(4, 4) // evicts 1
      cache.put(5, 5) // evicts 2
      expect(cache.get(1)).toBe(-1)
      expect(cache.get(2)).toBe(-1)
      expect(cache.get(3)).toBe(3)
      expect(cache.get(4)).toBe(4)
      expect(cache.get(5)).toBe(5)
    })
  })
})
