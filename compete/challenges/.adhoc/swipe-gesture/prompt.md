# Swipe Gesture Detection

Implement a set of pure functions for gesture discrimination and swipe detection in a mobile card-swiping interface.

## Types

```typescript
export interface Vector2D {
  x: number;
  y: number;
}

export interface GestureThresholds {
  /** Velocity below which drags always spring back (px/s) */
  slowDragVelocity: number;
  /** Velocity above which flicks trigger swipe (px/s) */
  fastFlickVelocity: number;
  /** Distance threshold for swipe detection (px) */
  offsetThreshold: number;
  /** Multiplier for horizontal vs vertical detection */
  horizontalBias: number;
}

export interface SwipeResult {
  direction: "left" | "right" | "skip" | null;
  shouldSpringBack: boolean;
}
```

## Functions to Implement

### `isSlowDrag(velocity: Vector2D, threshold: number): boolean`
Returns true if both x and y velocity components are below the threshold (use absolute values).

### `isFastFlick(velocityComponent: number, threshold: number): boolean`
Returns true if the absolute velocity exceeds the threshold.

### `isHorizontalDominant(offset: Vector2D, horizontalBias: number): boolean`
Returns true if `|x| > |y| * horizontalBias`.

### `isVerticalDominant(offset: Vector2D): boolean`
Returns true if `|y| > |x|`.

### `getDominantDirection(offset: Vector2D, horizontalBias: number): "horizontal" | "vertical" | "none"`
Returns the dominant direction based on bias rules.

### `processSwipeGesture(offset: Vector2D, velocity: Vector2D, canSwipeUp: boolean, thresholds?: GestureThresholds): SwipeResult`

Main function that processes a swipe gesture. Rules:
- **Horizontal swipes** (left/right): Always allowed if horizontal is dominant
  - Fast flick (velocity > fastFlickVelocity) with offset > offsetThreshold = swipe
  - Non-slow deliberate drag with offset > offsetThreshold = swipe  
  - Very significant offset (> offsetThreshold * 1.5) even if slow = swipe
  - Otherwise spring back
- **Vertical swipe up** (skip): Only upward (negative y)
  - Fast flick always triggers skip (overrides canSwipeUp)
  - Non-fast requires canSwipeUp=true AND (non-slow drag OR significant offset)
- **Default**: Spring back

**Default thresholds** (when not provided):
- slowDragVelocity: 200
- fastFlickVelocity: 500  
- offsetThreshold: 60
- horizontalBias: 1.5