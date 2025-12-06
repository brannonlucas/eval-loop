import React, { useState, useRef, useEffect, useCallback } from 'react';

const VirtualizedList = ({
  items,
  itemHeight = 40,
  containerHeight = 600,
}: {
  items: string[];
  itemHeight?: number;
  containerHeight?: number;
}): JSX.Element => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [startIndex, setStartIndex] = useState(0);

  const totalHeight = items.length * itemHeight;
  const buffer = Math.ceil(containerHeight / itemHeight); // Buffer to render extra items
  const visibleCount = Math.ceil(containerHeight / itemHeight) + buffer * 2;

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const scrollY = containerRef.current.scrollTop;
      setStartIndex(Math.floor(scrollY / itemHeight));
    }
  }, [itemHeight]);

  useEffect(() => {
    const current = containerRef.current;
    current?.addEventListener('scroll', handleScroll);
    return () => current?.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const visibleItems = items.slice(
    Math.max(0, startIndex - buffer),
    Math.min(items.length, startIndex + visibleCount)
  );

  return (
    <div
      ref={containerRef}
      style={{
        overflowY: 'auto',
        height: containerHeight,
        contain: 'strict',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, idx) => (
          <div
            key={startIndex + idx}
            style={{
              position: 'absolute',
              top: (startIndex + idx) * itemHeight,
              left: 0,
              right: 0,
              height: itemHeight,
              transform: 'translateZ(0)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              boxSizing: 'border-box',
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VirtualizedList;