# Virtualized List Challenge

## Competition Context

You are competing against other AI models to create the **smoothest, most performant, and smallest** virtualized list component. Your solution will be measured on:

1. **FPS (35% weight)**: How smooth is scrolling? Target: 55+ FPS at the 95th percentile
2. **Bundle Size (30% weight)**: How compact is your code? Target: < 1KB gzipped. **Every byte counts!**
3. **Render Efficiency (25% weight)**: How fast are your renders? Target: < 1ms average commit time
4. **Memory Stability (10% weight)**: Does memory stay stable during use?

**⚠️ Bundle size is critical!** The winning solution balances performance with minimal code. Avoid over-engineering - extra abstractions add bytes without improving FPS.

## Requirements

Create a React component that renders a virtualized list capable of handling 10,000+ items smoothly.

### Export Signature

```tsx
export default function VirtualizedList(props: {
  items: string[]
  itemHeight?: number
  containerHeight?: number
}): JSX.Element
```

### Props

- `items`: Array of string items to render (can be 10,000+)
- `itemHeight`: Height of each item in pixels (default: 40)
- `containerHeight`: Height of the scrollable container (default: 600)

### Functional Requirements

1. **Windowing**: Only render items currently visible in the viewport (plus a small buffer)
2. **Smooth Scrolling**: Maintain 60 FPS during rapid scrolling
3. **Correct Positioning**: Items must appear at correct scroll positions
4. **No External Libraries**: Implement from scratch (no react-window, react-virtualized, etc.)

### Technical Constraints

- No external dependencies beyond React
- Must work with React 18+ and StrictMode
- Use hooks (no class components)
- Handle edge cases: empty arrays, single items, resizing

## Winning Strategies

The winning solutions typically:
- **Keep it simple** - Less code = smaller bundle = higher score
- Use CSS transforms for item positioning (GPU-accelerated)
- Use `contain: strict` for better paint performance
- Avoid over-optimization - `React.memo()` and excessive `useMemo` add bytes
- Skip features you don't need (empty state handling, etc.)

**Anti-patterns that hurt your score:**
- Memoized sub-components (adds bundle size, minimal benefit)
- Hoisted style objects (adds bytes without improving perf)
- requestAnimationFrame throttling (React already batches updates)
- Excessive TypeScript types (stripped at build but add complexity)

## Example Usage

```tsx
const items = Array.from({ length: 10000 }, (_, i) => `Item ${i + 1}`)

<VirtualizedList
  items={items}
  itemHeight={40}
  containerHeight={600}
/>
```

## Test Cases

Your component will be tested for:
1. Renders without crashing with 10,000 items
2. Only renders visible items (not all 10,000)
3. Shows correct items at different scroll positions
4. Handles empty arrays gracefully
5. Handles single-item arrays
6. Maintains smooth scroll performance

Good luck! May the best AI win!
