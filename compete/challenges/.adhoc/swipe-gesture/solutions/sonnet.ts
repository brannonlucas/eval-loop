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

export function isSlowDrag(velocity: Vector2D, threshold: number): boolean {
  return Math.abs(velocity.x) < threshold && Math.abs(velocity.y) < threshold;
}

export function isFastFlick(velocityComponent: number, threshold: number): boolean {
  return Math.abs(velocityComponent) > threshold;
}

export function isHorizontalDominant(offset: Vector2D, horizontalBias: number): boolean {
  return Math.abs(offset.x) > Math.abs(offset.y) * horizontalBias;
}

export function isVerticalDominant(offset: Vector2D): boolean {
  return Math.abs(offset.y) > Math.abs(offset.x);
}

export function getDominantDirection(
  offset: Vector2D, 
  horizontalBias: number
): "horizontal" | "vertical" | "none" {
  if (isHorizontalDominant(offset, horizontalBias)) {
    return "horizontal";
  }
  if (isVerticalDominant(offset)) {
    return "vertical";
  }
  return "none";
}

export function processSwipeGesture(
  offset: Vector2D,
  velocity: Vector2D,
  canSwipeUp: boolean,
  thresholds?: GestureThresholds
): SwipeResult {
  // Set default thresholds
  const {
    slowDragVelocity = 200,
    fastFlickVelocity = 500,
    offsetThreshold = 60,
    horizontalBias = 1.5
  } = thresholds || {};

  const dominantDirection = getDominantDirection(offset, horizontalBias);
  const isSlowDragGesture = isSlowDrag(velocity, slowDragVelocity);

  // Handle horizontal swipes (left/right)
  if (dominantDirection === "horizontal") {
    const direction = offset.x > 0 ? "right" : "left";
    const offsetMagnitude = Math.abs(offset.x);
    const isFastHorizontalFlick = isFastFlick(velocity.x, fastFlickVelocity);
    
    // Fast flick with sufficient offset
    if (isFastHorizontalFlick && offsetMagnitude > offsetThreshold) {
      return { direction, shouldSpringBack: false };
    }
    
    // Non-slow deliberate drag with sufficient offset
    if (!isSlowDragGesture && offsetMagnitude > offsetThreshold) {
      return { direction, shouldSpringBack: false };
    }
    
    // Very significant offset (even if slow)
    if (offsetMagnitude > offsetThreshold * 1.5) {
      return { direction, shouldSpringBack: false };
    }
    
    // Otherwise spring back
    return { direction: null, shouldSpringBack: true };
  }

  // Handle vertical swipe up (skip) - only upward (negative y)
  if (dominantDirection === "vertical" && offset.y < 0) {
    const offsetMagnitude = Math.abs(offset.y);
    const isFastVerticalFlick = isFastFlick(velocity.y, fastFlickVelocity);
    
    // Fast flick always triggers skip (overrides canSwipeUp)
    if (isFastVerticalFlick) {
      return { direction: "skip", shouldSpringBack: false };
    }
    
    // Non-fast requires canSwipeUp=true AND (non-slow drag OR significant offset)
    if (canSwipeUp) {
      if (!isSlowDragGesture || offsetMagnitude > offsetThreshold) {
        return { direction: "skip", shouldSpringBack: false };
      }
    }
  }

  // Default: Spring back
  return { direction: null, shouldSpringBack: true };
}