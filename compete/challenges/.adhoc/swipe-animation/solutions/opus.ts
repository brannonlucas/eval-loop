const CONSTANTS = {
  ROTATION_RANGE: [-15, 0, 15],      // degrees
  POSITION_RANGE: [-200, 0, 200],    // pixels
  OPACITY_MAX_DISTANCE: 500,          // pixels
  CHOICE_OPACITY_RANGE: [-150, -50, 0],
  EXIT_DISTANCE: 1000,                // pixels
};

const POSITION_STYLES: Record<CardPosition, PositionStyle> = {
  [-1]: { scale: 1, y: 0, blur: 0, opacity: 0 },    // Exit
  [0]: { scale: 1, y: 0, blur: 0, opacity: 1 },     // Front
  [1]: { scale: 0.98, y: 16, blur: 2, opacity: 1 }, // First preview
  [2]: { scale: 0.96, y: 28, blur: 2, opacity: 1 }, // Second preview
};

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

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 */
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Calculate card opacity based on diagonal distance from center.
 * Uses Euclidean distance and returns opacity clamped to [0, 1].
 */
export function calculateDragOpacity(
  x: number,
  y: number,
  maxDistance: number = CONSTANTS.OPACITY_MAX_DISTANCE
): number {
  const distance = Math.sqrt(x * x + y * y);
  const opacity = 1 - distance / maxDistance;
  return clamp(opacity, 0, 1);
}

/**
 * Calculate left choice indicator opacity using piecewise linear interpolation.
 * - x <= -150: return 1
 * - x >= 0: return 0
 * - x in [-150, -50]: interpolate from 1 to 0.5
 * - x in [-50, 0]: interpolate from 0.5 to 0
 */
export function calculateLeftChoiceOpacity(x: number): number {
  if (x <= -150) return 1;
  if (x >= 0) return 0;
  
  if (x <= -50) {
    // x in [-150, -50]: interpolate from 1 to 0.5
    const t = (x - (-150)) / (-50 - (-150)); // t goes from 0 to 1
    return lerp(1, 0.5, t);
  } else {
    // x in [-50, 0]: interpolate from 0.5 to 0
    const t = (x - (-50)) / (0 - (-50)); // t goes from 0 to 1
    return lerp(0.5, 0, t);
  }
}

/**
 * Calculate right choice indicator opacity (mirror of left).
 * - x <= 0: return 0
 * - x >= 150: return 1
 * - x in [0, 50]: interpolate from 0 to 0.5
 * - x in [50, 150]: interpolate from 0.5 to 1
 */
export function calculateRightChoiceOpacity(x: number): number {
  if (x <= 0) return 0;
  if (x >= 150) return 1;
  
  if (x <= 50) {
    // x in [0, 50]: interpolate from 0 to 0.5
    const t = x / 50; // t goes from 0 to 1
    return lerp(0, 0.5, t);
  } else {
    // x in [50, 150]: interpolate from 0.5 to 1
    const t = (x - 50) / 100; // t goes from 0 to 1
    return lerp(0.5, 1, t);
  }
}

/**
 * Map x position to rotation angle.
 * Maps [-200, 0, 200] to [-15, 0, 15] degrees with linear interpolation.
 */
export function calculateRotation(x: number): number {
  const [minPos, , maxPos] = CONSTANTS.POSITION_RANGE;
  const [minRot, , maxRot] = CONSTANTS.ROTATION_RANGE;
  
  // Clamp x to valid range
  const clampedX = clamp(x, minPos, maxPos);
  
  // Linear interpolation: map [-200, 200] to [-15, 15]
  // Since the mapping is symmetric around 0, we can use simple proportion
  const t = (clampedX - minPos) / (maxPos - minPos); // t in [0, 1]
  return lerp(minRot, maxRot, t);
}

/**
 * Lookup position-based style for card in stack.
 * Returns the style from POSITION_STYLES for the given position.
 */
export function getPositionStyle(position: CardPosition): PositionStyle {
  if (position in POSITION_STYLES) {
    return POSITION_STYLES[position];
  }
  // Default to position 0 style if invalid
  return POSITION_STYLES[0];
}

/**
 * Calculate where card exits screen based on swipe direction.
 * Horizontal exits use viewportWidth + 200 buffer.
 */
export function calculateExitPosition(
  direction: SwipeDirection,
  viewportWidth: number = 1000
): ExitPosition {
  const horizontalExit = viewportWidth + 200;
  
  switch (direction) {
    case "left":
      return { x: -horizontalExit, y: 0 };
    case "right":
      return { x: horizontalExit, y: 0 };
    case "skip":
      return { x: 0, y: -CONSTANTS.EXIT_DISTANCE };
  }
}