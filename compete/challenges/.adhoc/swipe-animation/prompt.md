# Swipe Animation Calculations

Implement pure functions for real-time animation value calculations in a card-swiping interface. These functions run at 60fps during drag gestures.

## Constants

```typescript
const CONSTANTS = {
  ROTATION_RANGE: [-15, 0, 15],      // degrees
  POSITION_RANGE: [-200, 0, 200],    // pixels
  OPACITY_MAX_DISTANCE: 500,          // pixels
  CHOICE_OPACITY_RANGE: [-150, -50, 0],
  EXIT_DISTANCE: 1000,                // pixels
};

const POSITION_STYLES = {
  [-1]: { scale: 1, y: 0, blur: 0, opacity: 0 },    // Exit
  [0]: { scale: 1, y: 0, blur: 0, opacity: 1 },     // Front
  [1]: { scale: 0.98, y: 16, blur: 2, opacity: 1 }, // First preview
  [2]: { scale: 0.96, y: 28, blur: 2, opacity: 1 }, // Second preview
};
```

## Types

```typescript
export type SwipeDirection = "left" | "right" | "skip";
export type CardPosition = -1 | 0 | 1 | 2;

export interface ExitPosition {
  x: number;
  y: number;
}

export interface PositionStyle {
  scale: number;
  y: number;
  blur: number;
  opacity: number;
}
```

## Functions to Implement

### `calculateDragOpacity(x: number, y: number, maxDistance?: number): number`
Calculate card opacity based on diagonal distance from center.
- Uses `Math.sqrt(x² + y²)` for distance
- Returns `1 - (distance / maxDistance)`, clamped to [0, 1]
- Default maxDistance: 500

### `calculateLeftChoiceOpacity(x: number): number`
Calculate left choice indicator opacity using piecewise linear interpolation.
- x <= -150: return 1
- x >= 0: return 0
- x in [-150, -50]: interpolate from 1 to 0.5
- x in [-50, 0]: interpolate from 0.5 to 0

### `calculateRightChoiceOpacity(x: number): number`
Mirror of left choice opacity.
- x <= 0: return 0
- x >= 150: return 1
- x in [0, 50]: interpolate from 0 to 0.5
- x in [50, 150]: interpolate from 0.5 to 1

### `calculateRotation(x: number): number`
Map x position to rotation angle.
- Maps [-200, 0, 200] to [-15, 0, 15] degrees
- Clamp x to [-200, 200] before interpolating
- Linear interpolation within each segment

### `getPositionStyle(position: CardPosition): PositionStyle`
Lookup position-based style for card in stack.
- Return the style from POSITION_STYLES for the given position
- Default to position 0 style if invalid

### `calculateExitPosition(direction: SwipeDirection, viewportWidth?: number): ExitPosition`
Calculate where card exits screen.
- Default viewportWidth: 1000
- Horizontal exit: viewportWidth + 200 buffer
- left: { x: -(viewportWidth + 200), y: 0 }
- right: { x: viewportWidth + 200, y: 0 }
- skip: { x: 0, y: -1000 }