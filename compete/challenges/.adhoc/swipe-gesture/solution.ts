export interface Vector2D {
  x: number;
  y: number;
}

export interface GestureThresholds {
  slowDragVelocity: number;
  fastFlickVelocity: number;
  offsetThreshold: number;
  horizontalBias: number;
}

export interface SwipeResult {
  direction: "left" | "right" | "skip" | null;
  shouldSpringBack: boolean;
}

export const DEFAULT_THRESHOLDS: GestureThresholds = {
  slowDragVelocity: 200,
  fastFlickVelocity: 500,
  offsetThreshold: 60,
  horizontalBias: 1.5,
};

// Pre-allocated result objects to avoid GC pressure in hot path (60fps)
const RESULT_LEFT: SwipeResult = Object.freeze({ direction: "left", shouldSpringBack: false });
const RESULT_RIGHT: SwipeResult = Object.freeze({ direction: "right", shouldSpringBack: false });
const RESULT_SKIP: SwipeResult = Object.freeze({ direction: "skip", shouldSpringBack: false });
const RESULT_SPRING_BACK: SwipeResult = Object.freeze({ direction: null, shouldSpringBack: true });

/** Inline abs - avoids function call overhead in hot path */
const abs = (n: number): number => (n < 0 ? -n : n);

export function isSlowDrag(velocity: Vector2D, threshold: number): boolean {
  const absVx = abs(velocity.x);
  if (absVx >= threshold) return false;
  return abs(velocity.y) < threshold;
}

export function isFastFlick(velocityComponent: number, threshold: number): boolean {
  return abs(velocityComponent) > threshold;
}

export function isHorizontalDominant(offset: Vector2D, horizontalBias: number): boolean {
  return abs(offset.x) > abs(offset.y) * horizontalBias;
}

export function isVerticalDominant(offset: Vector2D): boolean {
  return abs(offset.y) > abs(offset.x);
}

export function getDominantDirection(
  offset: Vector2D,
  horizontalBias: number
): "horizontal" | "vertical" | "none" {
  const absX = abs(offset.x);
  const absY = abs(offset.y);
  if (absX > absY * horizontalBias) return "horizontal";
  if (absY > absX) return "vertical";
  return "none";
}

export function processSwipeGesture(
  offset: Vector2D,
  velocity: Vector2D,
  canSwipeUp: boolean,
  thresholds: GestureThresholds = DEFAULT_THRESHOLDS
): SwipeResult {
  const { slowDragVelocity, fastFlickVelocity, offsetThreshold, horizontalBias } = thresholds;

  const absOffsetX = abs(offset.x);
  const absOffsetY = abs(offset.y);
  const absVelX = abs(velocity.x);
  const absVelY = abs(velocity.y);

  const slowDrag = absVelX < slowDragVelocity && absVelY < slowDragVelocity;
  const fastFlickX = absVelX > fastFlickVelocity;
  const fastFlickY = absVelY > fastFlickVelocity;

  const hasHorizontalOffset = absOffsetX > offsetThreshold;
  const hasVerticalOffset = absOffsetY > offsetThreshold;
  const significantThreshold = offsetThreshold * 1.5;
  const hasSignificantVerticalOffset = absOffsetY > significantThreshold;
  const hasSignificantHorizontalOffset = absOffsetX > significantThreshold;

  const isHorizDom = absOffsetX > absOffsetY * horizontalBias;
  const isVertDom = absOffsetY > absOffsetX;

  if (isHorizDom) {
    const result = offset.x < 0 ? RESULT_LEFT : RESULT_RIGHT;
    if (fastFlickX && hasHorizontalOffset) return result;
    if (!slowDrag && hasHorizontalOffset) return result;
    if (hasSignificantHorizontalOffset) return result;
  }

  if (isVertDom && offset.y < 0) {
    if (fastFlickY && hasVerticalOffset) return RESULT_SKIP;
    if (canSwipeUp) {
      if (!slowDrag && hasVerticalOffset) return RESULT_SKIP;
      if (hasSignificantVerticalOffset) return RESULT_SKIP;
    }
  }

  return RESULT_SPRING_BACK;
}