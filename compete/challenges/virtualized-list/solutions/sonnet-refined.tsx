import { useState, useRef } from 'react';

export default function VirtualizedList({
  items,
  itemHeight = 40,
  containerHeight = 600
}: {
  items: string[]
  itemHeight?: number
  containerHeight?: number
}): JSX.Element {
  const [scrollTop, setScrollTop] = useState(0);
  
  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 1);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + 1
  );

  const visibleItems = [];
  for (let i = startIndex; i < endIndex; i++) {
    visibleItems.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          top: i * itemHeight,
          height: itemHeight,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          contain: 'layout style paint'
        }}
      >
        {items[i]}
      </div>
    );
  }

  return (
    <div
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative'
      }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems}
      </div>
    </div>
  );
}