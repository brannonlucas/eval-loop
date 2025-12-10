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

const DEFAULT_THRESHOLDS: GestureThresholds = {
  slowDragVelocity: 200,
  fastFlickVelocity: 500,
  offsetThreshold: 60,
  horizontalBias: 1.5,
};

/**
 * Returns true if both x and y velocity components are below the threshold
 */
export function isSlowDrag(velocity: Vector2D, threshold: number): boolean {
  return Math.abs(velocity.x) < threshold && Math.abs(velocity.y) < threshold;
}

/**
 * Returns true if the absolute velocity exceeds the threshold
 */
export function isFastFlick(velocityComponent: number, threshold: number): boolean {
  return Math.abs(velocityComponent) > threshold;
}

/**
 * Returns true if |x| > |y| * horizontalBias
 */
export function isHorizontalDominant(offset: Vector2D, horizontalBias: number): boolean {
  return Math.abs(offset.x) > Math.abs(offset.y) * horizontalBias;
}

/**
 * Returns true if |y| > |x|
 */
export function isVerticalDominant(offset: Vector2D): boolean {
  return Math.abs(offset.y) > Math.abs(offset.x);
}

/**
 * Returns the dominant direction based on bias rules
 */
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

/**
 * Main function that processes a swipe gesture
 */
export function processSwipeGesture(
  offset: Vector2D,
  velocity: Vector2D,
  canSwipeUp: boolean,
  thresholds?: GestureThresholds
): SwipeResult {
  const t = thresholds ?? DEFAULT_THRESHOLDS;
  const dominantDirection = getDominantDirection(offset, t.horizontalBias);

  // Default result - spring back with no direction
  const springBack: SwipeResult = {
    direction: null,
    shouldSpringBack: true,
  };

  // Handle horizontal swipes (left/right)
  if (dominantDirection === "horizontal") {
    const direction: "left" | "right" = offset.x < 0 ? "left" : "right";
    const absOffsetX = Math.abs(offset.x);
    const meetsOffsetThreshold = absOffsetX > t.offsetThreshold;
    const meetsSignificantOffset = absOffsetX > t.offsetThreshold * 1.5;
    const isFast = isFastFlick(velocity.x, t.fastFlickVelocity);
    const isSlow = isSlowDrag(velocity, t.slowDragVelocity);

    // Fast flick with offset > threshold = swipe
    if (isFast && meetsOffsetThreshold) {
      return { direction, shouldSpringBack: false };
    }

    // Non-slow deliberate drag with offset > threshold = swipe
    if (!isSlow && meetsOffsetThreshold) {
      return { direction, shouldSpringBack: false };
    }

    // Very significant offset even if slow = swipe
    if (meetsSignificantOffset) {
      return { direction, shouldSpringBack: false };
    }

    return springBack;
  }

  // Handle vertical swipe up (skip) - only upward (negative y)
  if (dominantDirection === "vertical" && offset.y < 0) {
    const absOffsetY = Math.abs(offset.y);
    const isFast = isFastFlick(velocity.y, t.fastFlickVelocity);
    const isSlow = isSlowDrag(velocity, t.slowDragVelocity);
    const meetsOffsetThreshold = absOffsetY > t.offsetThreshold;
    const meetsSignificantOffset = absOffsetY > t.offsetThreshold * 1.5;

    // Fast flick always triggers skip (overrides canSwipeUp)
    if (isFast) {
      return { direction: "skip", shouldSpringBack: false };
    }

    // Non-fast requires canSwipeUp=true AND (non-slow drag OR significant offset)
    if (canSwipeUp && (!isSlow || meetsSignificantOffset) && meetsOffsetThreshold) {
      return { direction: "skip", shouldSpringBack: false };
    }

    return springBack;
  }

  // Default: spring back
  return springBack;
}