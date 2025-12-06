import { useState, useLayoutEffect, useRef } from 'react'

export default function VirtualizedList({
  items,
  itemHeight = 40,
  containerHeight = 600
}: {
  items: string[]
  itemHeight?: number
  containerHeight?: number
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const totalHeight = items.length * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 2)
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + 2
  )
  
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const handleScroll = () => setScrollTop(container.scrollTop)
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])
  
  return (
    <div
      ref={containerRef}
      style={{
        height: containerHeight,
        overflow: 'auto',
        contain: 'strict'
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {items.slice(startIndex, endIndex).map((item, i) => (
          <div
            key={startIndex + i}
            style={{
              position: 'absolute',
              top: (startIndex + i) * itemHeight,
              height: itemHeight,
              width: '100%',
              transform: 'translateZ(0)'
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}