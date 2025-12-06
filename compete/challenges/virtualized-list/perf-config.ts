/**
 * Performance test configuration for VirtualizedList
 */

import type { Page } from 'playwright'

// Generate 10,000 items for the performance test
export const componentProps = {
  items: Array.from({ length: 10000 }, (_, i) => `Item ${i + 1}`),
  itemHeight: 40,
  containerHeight: 600,
}

/**
 * Custom interaction script for scrolling test
 * Simulates realistic user scroll behavior
 */
export async function interactionScript(page: Page): Promise<void> {
  // Wait for component to mount
  await page.waitForSelector('[data-testid="virtualized-list"]', { timeout: 5000 }).catch(() => {
    // Fallback: wait for any scrollable container
    return page.waitForSelector('div', { timeout: 1000 })
  })

  const testDuration = 3000 // 3 seconds
  const startTime = Date.now()

  // Scroll through the list rapidly
  while (Date.now() - startTime < testDuration) {
    // Scroll down
    await page.mouse.wheel(0, 300)
    await sleep(16) // ~60fps timing

    // Occasional scroll up for realistic behavior
    if (Math.random() > 0.8) {
      await page.mouse.wheel(0, -150)
      await sleep(16)
    }

    // Occasional pause (user reading)
    if (Math.random() > 0.9) {
      await sleep(50)
    }
  }

  // Rapid scroll to bottom
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 500)
    await sleep(16)
  }

  // Rapid scroll back to top
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, -500)
    await sleep(16)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
