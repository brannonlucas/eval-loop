import { describe, bench } from 'vitest'
import {
  isSlowDrag,
  isFastFlick,
  isHorizontalDominant,
  isVerticalDominant,
  getDominantDirection,
  processSwipeGesture,
  type GestureThresholds,
} from './solution'

const thresholds: GestureThresholds = {
  slowDragVelocity: 200,
  fastFlickVelocity: 500,
  offsetThreshold: 60,
  horizontalBias: 1.5,
}

// Simulate realistic gesture data
const generateGestureData = (count: number) => {
  const data = []
  for (let i = 0; i < count; i++) {
    data.push({
      offset: { x: (Math.random() - 0.5) * 200, y: (Math.random() - 0.5) * 200 },
      velocity: { x: (Math.random() - 0.5) * 1000, y: (Math.random() - 0.5) * 1000 },
      canSwipeUp: Math.random() > 0.5,
    })
  }
  return data
}

// Pre-generate test data to avoid allocation during benchmark
const gestureData10k = generateGestureData(10000)
const gestureData100k = generateGestureData(100000)

describe('Swipe Gesture - Benchmarks', () => {
  describe('Individual functions (hot path)', () => {
    bench('isSlowDrag - 100k calls', () => {
      for (let i = 0; i < 100000; i++) {
        isSlowDrag({ x: i % 300 - 150, y: i % 200 - 100 }, 200)
      }
    })

    bench('isFastFlick - 100k calls', () => {
      for (let i = 0; i < 100000; i++) {
        isFastFlick(i % 1000 - 500, 500)
      }
    })

    bench('isHorizontalDominant - 100k calls', () => {
      for (let i = 0; i < 100000; i++) {
        isHorizontalDominant({ x: i % 200 - 100, y: i % 150 - 75 }, 1.5)
      }
    })

    bench('getDominantDirection - 100k calls', () => {
      for (let i = 0; i < 100000; i++) {
        getDominantDirection({ x: i % 200 - 100, y: i % 150 - 75 }, 1.5)
      }
    })
  })

  describe('processSwipeGesture (full pipeline)', () => {
    bench('10k realistic gestures', () => {
      for (const { offset, velocity, canSwipeUp } of gestureData10k) {
        processSwipeGesture(offset, velocity, canSwipeUp, thresholds)
      }
    })

    bench('100k realistic gestures', () => {
      for (const { offset, velocity, canSwipeUp } of gestureData100k) {
        processSwipeGesture(offset, velocity, canSwipeUp, thresholds)
      }
    })

    bench('60fps simulation (1000 frames)', () => {
      // Simulate 1000 frames at 60fps - typical swipe gesture duration
      for (let frame = 0; frame < 1000; frame++) {
        const progress = frame / 1000
        // Simulate a left swipe gesture trajectory
        const offset = { x: -progress * 150, y: Math.sin(progress * Math.PI) * 20 }
        const velocity = { x: -300 - progress * 200, y: Math.cos(progress * Math.PI) * 50 }
        processSwipeGesture(offset, velocity, true, thresholds)
      }
    })

    bench('rapid direction changes (worst case)', () => {
      // Simulate user wiggling finger rapidly
      for (let i = 0; i < 10000; i++) {
        const offset = {
          x: Math.sin(i * 0.5) * 100,
          y: Math.cos(i * 0.7) * 100,
        }
        const velocity = {
          x: Math.cos(i * 0.5) * 500,
          y: -Math.sin(i * 0.7) * 500,
        }
        processSwipeGesture(offset, velocity, i % 2 === 0, thresholds)
      }
    })
  })
})
