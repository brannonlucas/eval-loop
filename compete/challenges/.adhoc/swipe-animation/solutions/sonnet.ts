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

export function calculateDragOpacity(x: number, y: number, maxDistance: number = CONSTANTS.OPACITY_MAX_DISTANCE): number {
  const distance = Math.sqrt(x * x + y * y);
  const opacity = 1 - (distance / maxDistance);
  return Math.max(0, Math.min(1, opacity));
}

export function calculateLeftChoiceOpacity(x: number): number {
  if (x <= -150) return 1;
  if (x >= 0) return 0;
  
  if (x >= -150 && x <= -50) {
    // Interpolate from 1 to 0.5 over range [-150, -50]
    return 1 - (x + 150) / (-50 + 150) * 0.5;
  }
  
  // x in range [-50, 0]
  // Interpolate from 0.5 to 0 over range [-50, 0]
  return 0.5 - (x + 50) / (0 + 50) * 0.5;
}

export function calculateRightChoiceOpacity(x: number): number {
  if (x <= 0) return 0;
  if (x >= 150) return 1;
  
  if (x >= 0 && x <= 50) {
    // Interpolate from 0 to 0.5 over range [0, 50]
    return (x - 0) / (50 - 0) * 0.5;
  }
  
  // x in range [50, 150]
  // Interpolate from 0.5 to 1 over range [50, 150]
  return 0.5 + (x - 50) / (150 - 50) * 0.5;
}

export function calculateRotation(x: number): number {
  // Clamp x to [-200, 200]
  const clampedX = Math.max(-200, Math.min(200, x));
  
  if (clampedX <= 0) {
    // Map [-200, 0] to [-15, 0]
    return -15 + (clampedX + 200) / 200 * 15;
  } else {
    // Map [0, 200] to [0, 15]
    return (clampedX / 200) * 15;
  }
}

export function getPositionStyle(position: CardPosition): PositionStyle {
  return POSITION_STYLES[position] || POSITION_STYLES[0];
}

export function calculateExitPosition(direction: SwipeDirection, viewportWidth: number = 1000): ExitPosition {
  switch (direction) {
    case "left":
      return { x: -(viewportWidth + 200), y: 0 };
    case "right":
      return { x: viewportWidth + 200, y: 0 };
    case "skip":
      return { x: 0, y: -1000 };
    default:
      return { x: 0, y: 0 };
  }
}