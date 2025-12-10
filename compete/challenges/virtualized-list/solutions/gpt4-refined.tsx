import { useState, useEffect, useRef, useCallback } from 'react'

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
  const buffer = 5
  const startIndex = Math.floor(scrollTop / itemHeight) - buffer
  const endIndex = Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

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
        {items.slice(Math.max(0, startIndex), Math.min(items.length, endIndex)).map((item, i) => (
          <div
            key={startIndex + i}
            style={{
              position: 'absolute',
              top: (startIndex + i) * itemHeight,
              height: itemHeight,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              borderBottom: '1px solid #eee',
              willChange: 'transform'
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}