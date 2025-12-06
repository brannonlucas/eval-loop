import { describe, bench } from 'vitest'
import { LRUCache } from './solution'

describe('LRUCache - Benchmarks', () => {
  bench('10k operations (mixed get/put)', () => {
    const cache = new LRUCache(1000)
    for (let i = 0; i < 10000; i++) {
      if (i % 3 === 0) {
        cache.get(Math.floor(Math.random() * 2000))
      } else {
        cache.put(Math.floor(Math.random() * 2000), i)
      }
    }
  })

  bench('50k operations (mixed get/put)', () => {
    const cache = new LRUCache(5000)
    for (let i = 0; i < 50000; i++) {
      if (i % 3 === 0) {
        cache.get(Math.floor(Math.random() * 10000))
      } else {
        cache.put(Math.floor(Math.random() * 10000), i)
      }
    }
  })

  bench('100k operations (mixed get/put)', () => {
    const cache = new LRUCache(10000)
    for (let i = 0; i < 100000; i++) {
      if (i % 3 === 0) {
        cache.get(Math.floor(Math.random() * 20000))
      } else {
        cache.put(Math.floor(Math.random() * 20000), i)
      }
    }
  })

  bench('100k operations (high eviction rate)', () => {
    const cache = new LRUCache(100) // Small cache = lots of evictions
    for (let i = 0; i < 100000; i++) {
      if (i % 2 === 0) {
        cache.put(i, i)
      } else {
        cache.get(Math.floor(Math.random() * i))
      }
    }
  })

  bench('100k sequential puts then gets', () => {
    const cache = new LRUCache(10000)
    // Fill then read
    for (let i = 0; i < 50000; i++) {
      cache.put(i, i)
    }
    for (let i = 0; i < 50000; i++) {
      cache.get(i % 10000)
    }
  })
})
