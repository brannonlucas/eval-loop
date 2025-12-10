import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function VirtualizedList({
  items,
  itemHeight = 40,
  containerHeight = 600,
}: {
  items: string[];
  itemHeight?: number;
  containerHeight?: number;
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const itemsInView = Math.ceil(containerHeight / itemHeight);
  const bufferItems = 5;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferItems);
  const endIndex = Math.min(
    items.length,
    startIndex + itemsInView + bufferItems * 2
  );

  useEffect(() => {
    const onScroll = () => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop);
      }
    };
    const container = containerRef.current;
    container?.addEventListener('scroll', onScroll);
    return () => container?.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: containerHeight,
        overflow: 'auto',
        willChange: 'transform',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {items.slice(startIndex, endIndex).map((item, index) => (
          <div
            key={startIndex + index}
            style={{
              position: 'absolute',
              top: (startIndex + index) * itemHeight,
              width: '100%',
              height: itemHeight,
              boxSizing: 'border-box',
              contain: 'strict',
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}