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

const POSITION_STYLES: Record<CardPosition, PositionStyle> = {
  [-1]: { scale: 1, y: 0, blur: 0, opacity: 0 },
  [0]: { scale: 1, y: 0, blur: 0, opacity: 1 },
  [1]: { scale: 0.98, y: 16, blur: 2, opacity: 1 },
  [2]: { scale: 0.96, y: 28, blur: 2, opacity: 1 },
};

const EXIT_DISTANCE = 1000;

export function calculateDragOpacity(
  x: number,
  y: number,
  maxDistance: number = 500
): number {
  const distance = Math.sqrt(x * x + y * y);
  return Math.max(0, 1 - distance / maxDistance);
}

export function calculateLeftChoiceOpacity(x: number): number {
  const range = [-150, -50, 0];
  if (x <= range[0]) return 1;
  if (x >= range[2]) return 0;
  if (x <= range[1]) {
    const t = (x - range[0]) / (range[1] - range[0]);
    return 1 - t * 0.5;
  }
  const t = (x - range[1]) / (range[2] - range[1]);
  return 0.5 - t * 0.5;
}

export function calculateRightChoiceOpacity(x: number): number {
  const leftRange = [-150, -50, 0];
  const rangeStart = -leftRange[2];
  const rangeMid = -leftRange[1];
  const rangeEnd = -leftRange[0];

  if (x <= rangeStart) return 0;
  if (x >= rangeEnd) return 1;
  if (x <= rangeMid) {
    return (x / rangeMid) * 0.5;
  }
  return 0.5 + ((x - rangeMid) / (rangeEnd - rangeMid)) * 0.5;
}

export function calculateRotation(x: number): number {
  const posRange = [-200, 0, 200];
  const rotRange = [-15, 0, 15];

  const clampedX = Math.max(posRange[0], Math.min(posRange[2], x));

  if (clampedX <= 0) {
    const t = (clampedX - posRange[0]) / (posRange[1] - posRange[0]);
    return rotRange[0] + t * (rotRange[1] - rotRange[0]);
  }

  const t = clampedX / posRange[2];
  return t * rotRange[2];
}

export function getPositionStyle(position: CardPosition): PositionStyle {
  return POSITION_STYLES[position] ?? POSITION_STYLES[0];
}

export function calculateExitPosition(
  direction: SwipeDirection,
  viewportWidth: number = 1000
): ExitPosition {
  const horizontalExitDistance = viewportWidth + 200;

  switch (direction) {
    case "left":
      return { x: -horizontalExitDistance, y: 0 };
    case "right":
      return { x: horizontalExitDistance, y: 0 };
    case "skip":
      return { x: 0, y: -EXIT_DISTANCE };
  }
}