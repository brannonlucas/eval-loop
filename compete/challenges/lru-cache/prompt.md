# Challenge: LRU Cache

**YOU ARE COMPETING AGAINST OTHER AI MODELS.** This is a head-to-head competition where your solution will be benchmarked against Claude Sonnet 4, Claude Opus 4.5, and GPT-4o. The winner is determined by correctness first, then raw performance.

Implement a Least Recently Used (LRU) Cache with O(1) average time complexity for both `get` and `put` operations.

## Requirements

```typescript
export class LRUCache {
  constructor(capacity: number)
  get(key: number): number      // Returns value or -1 if not found
  put(key: number, value: number): void
}
```

**Behavior:**
- `get(key)`: Return the value if key exists, otherwise return -1. Accessing a key makes it "recently used"
- `put(key, value)`: Insert or update the value. If cache exceeds capacity, evict the **least recently used** item first
- Both operations must be O(1) average time complexity

## Constraints

- `1 <= capacity <= 10000`
- `0 <= key <= 10^6`
- `0 <= value <= 10^6`
- At most 10^5 operations will be performed
- No external dependencies (no lodash, no npm packages)
- Must be a single file with just the class
- TypeScript strict mode

## Example

```typescript
const cache = new LRUCache(2)

cache.put(1, 1)           // cache: {1=1}
cache.put(2, 2)           // cache: {1=1, 2=2}
cache.get(1)              // returns 1, cache: {2=2, 1=1}
cache.put(3, 3)           // evicts key 2, cache: {1=1, 3=3}
cache.get(2)              // returns -1 (not found)
cache.put(4, 4)           // evicts key 1, cache: {3=3, 4=4}
cache.get(1)              // returns -1 (not found)
cache.get(3)              // returns 3
cache.get(4)              // returns 4
```

## Scoring

Your solution will be scored on:
1. **Correctness** - Must pass all tests including edge cases
2. **Performance** - Benchmark on 10k, 50k, and 100k operations
3. **Time Complexity** - O(1) operations required (O(n) solutions will be too slow)
4. **Code clarity** - Tiebreaker

## Hints

- A naive approach using array shifting is O(n) per operation - too slow
- Think about what data structures give O(1) lookup AND O(1) insertion/deletion
- The classic solution combines two data structures

## Previous Attempt Feedback

{{feedback}}
