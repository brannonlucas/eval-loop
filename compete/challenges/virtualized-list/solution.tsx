import { useState, useRef, useCallback } from 'react'

export default function VirtualizedList({
  items,
  itemHeight = 40,
  containerHeight = 600,
}: {
  items: string[]
  itemHeight?: number
  containerHeight?: number
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const totalHeight = items.length * itemHeight
  const overscan = 3
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan * 2
  const endIndex = Math.min(items.length, startIndex + visibleCount)

  const onScroll = useCallback(() => {
    if (ref.current) setScrollTop(ref.current.scrollTop)
  }, [])

  const visibleItems = []
  for (let i = startIndex; i < endIndex; i++) {
    visibleItems.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: itemHeight,
          transform: `translateY(${i * itemHeight}px)`,
          contain: 'strict',
        }}
      >
        {items[i]}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems}
      </div>
    </div>
  )
}