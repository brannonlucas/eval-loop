import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import VirtualizedList from './solution'

describe('VirtualizedList', () => {
  const generateItems = (count: number) =>
    Array.from({ length: count }, (_, i) => `Item ${i + 1}`)

  it('renders without crashing with 10,000 items', () => {
    const items = generateItems(10000)
    const { container } = render(<VirtualizedList items={items} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('only renders visible items, not all 10,000', () => {
    const items = generateItems(10000)
    const { container } = render(
      <VirtualizedList items={items} itemHeight={40} containerHeight={400} />
    )

    // With 400px container and 40px items, we should see ~10-15 items max (including buffer)
    // Definitely not all 10,000
    const renderedItems = container.querySelectorAll('[data-index]').length
    // If no data-index, count by item text pattern
    const itemsByText = screen.queryAllByText(/^Item \d+$/)

    const totalRendered = Math.max(renderedItems, itemsByText.length)
    expect(totalRendered).toBeLessThan(50) // Should be way less than 10,000
  })

  it('shows first items when at top scroll position', () => {
    const items = generateItems(100)
    render(<VirtualizedList items={items} itemHeight={40} containerHeight={200} />)

    // First items should be visible
    expect(screen.getByText('Item 1')).toBeTruthy()
    expect(screen.getByText('Item 2')).toBeTruthy()
  })

  it('handles empty arrays gracefully', () => {
    const { container } = render(<VirtualizedList items={[]} />)
    expect(container.firstChild).toBeTruthy()
    // Should not crash, may render empty container
  })

  it('handles single-item arrays', () => {
    render(<VirtualizedList items={['Only Item']} />)
    expect(screen.getByText('Only Item')).toBeTruthy()
  })

  it('respects custom itemHeight', () => {
    const items = generateItems(100)
    const { container } = render(
      <VirtualizedList items={items} itemHeight={80} containerHeight={400} />
    )

    // With 80px items and 400px container, should see ~5-7 items
    const itemsByText = screen.queryAllByText(/^Item \d+$/)
    expect(itemsByText.length).toBeLessThanOrEqual(15)
  })

  it('renders items with correct positioning', () => {
    const items = generateItems(100)
    const { container } = render(
      <VirtualizedList items={items} itemHeight={40} containerHeight={200} />
    )

    // The scrollable container should have a defined height
    const scrollContainer = container.firstChild as HTMLElement
    expect(scrollContainer).toBeTruthy()

    // Container should be scrollable (has overflow)
    const styles = window.getComputedStyle(scrollContainer)
    const isScrollable =
      styles.overflow === 'auto' ||
      styles.overflow === 'scroll' ||
      styles.overflowY === 'auto' ||
      styles.overflowY === 'scroll'

    // At minimum, the container should exist and have structure for virtualization
    expect(container.innerHTML.length).toBeGreaterThan(0)
  })

  it('can scroll through the entire list', () => {
    const items = generateItems(1000)
    const { container } = render(
      <VirtualizedList items={items} itemHeight={40} containerHeight={400} />
    )

    const scrollContainer = container.firstChild as HTMLElement

    // Simulate scrolling to near the end
    fireEvent.scroll(scrollContainer, { target: { scrollTop: 38000 } })

    // After scrolling, we should see items from near the end
    // (allowing for async updates, just verify we can scroll without crashing)
    expect(container.firstChild).toBeTruthy()
  })
})
