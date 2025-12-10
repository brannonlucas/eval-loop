import { describe, expect, it } from 'vitest';

import {
  calculateDragOpacity,
  calculateExitPosition,
  calculateLeftChoiceOpacity,
  calculateRightChoiceOpacity,
  calculateRotation,
  getPositionStyle,
} from './solution';

describe('swipe-animation', () => {
  describe('calculateDragOpacity', () => {
    it('returns 1 when at center', () => {
      expect(calculateDragOpacity(0, 0)).toBe(1);
    });

    it('returns 0 at max distance', () => {
      expect(calculateDragOpacity(500, 0)).toBe(0);
      expect(calculateDragOpacity(0, 500)).toBe(0);
    });

    it('returns 0.5 at half max distance', () => {
      expect(calculateDragOpacity(250, 0)).toBeCloseTo(0.5);
    });

    it('calculates diagonal distance correctly', () => {
      // Distance = sqrt(300^2 + 400^2) = 500 = max distance
      expect(calculateDragOpacity(300, 400)).toBe(0);
    });

    it('clamps to 0 beyond max distance', () => {
      expect(calculateDragOpacity(600, 0)).toBe(0);
    });

    it('accepts custom max distance', () => {
      expect(calculateDragOpacity(50, 0, 100)).toBe(0.5);
    });
  });

  describe('calculateLeftChoiceOpacity', () => {
    it('returns 0 when x >= 0', () => {
      expect(calculateLeftChoiceOpacity(0)).toBe(0);
      expect(calculateLeftChoiceOpacity(100)).toBe(0);
    });

    it('returns 1 when x <= -150', () => {
      expect(calculateLeftChoiceOpacity(-150)).toBe(1);
      expect(calculateLeftChoiceOpacity(-200)).toBe(1);
    });

    it('returns 0.5 at x = -50', () => {
      expect(calculateLeftChoiceOpacity(-50)).toBeCloseTo(0.5);
    });

    it('interpolates between control points', () => {
      const opacity = calculateLeftChoiceOpacity(-100);
      expect(opacity).toBeGreaterThan(0.5);
      expect(opacity).toBeLessThan(1);
    });
  });

  describe('calculateRightChoiceOpacity', () => {
    it('returns 0 when x <= 0', () => {
      expect(calculateRightChoiceOpacity(0)).toBe(0);
      expect(calculateRightChoiceOpacity(-100)).toBe(0);
    });

    it('returns 1 when x >= 150', () => {
      expect(calculateRightChoiceOpacity(150)).toBe(1);
      expect(calculateRightChoiceOpacity(200)).toBe(1);
    });

    it('returns 0.5 at x = 50', () => {
      expect(calculateRightChoiceOpacity(50)).toBeCloseTo(0.5);
    });

    it('interpolates between control points', () => {
      const opacity = calculateRightChoiceOpacity(100);
      expect(opacity).toBeGreaterThan(0.5);
      expect(opacity).toBeLessThan(1);
    });
  });

  describe('calculateRotation', () => {
    it('returns 0 at center', () => {
      expect(calculateRotation(0)).toBe(0);
    });

    it('returns -15 at x = -200', () => {
      expect(calculateRotation(-200)).toBe(-15);
    });

    it('returns 15 at x = 200', () => {
      expect(calculateRotation(200)).toBe(15);
    });

    it('clamps at extremes', () => {
      expect(calculateRotation(-300)).toBe(-15);
      expect(calculateRotation(300)).toBe(15);
    });

    it('interpolates correctly at halfway', () => {
      expect(calculateRotation(-100)).toBeCloseTo(-7.5);
      expect(calculateRotation(100)).toBeCloseTo(7.5);
    });
  });

  describe('getPositionStyle', () => {
    it('returns correct style for front card (0)', () => {
      expect(getPositionStyle(0)).toEqual({
        scale: 1,
        y: 0,
        blur: 0,
        opacity: 1,
      });
    });

    it('returns correct style for exit (-1)', () => {
      const style = getPositionStyle(-1);
      expect(style.opacity).toBe(0);
    });

    it('returns correct style for first preview (1)', () => {
      const style = getPositionStyle(1);
      expect(style.scale).toBe(0.98);
      expect(style.y).toBe(16);
    });

    it('returns correct style for second preview (2)', () => {
      const style = getPositionStyle(2);
      expect(style.scale).toBe(0.96);
      expect(style.y).toBe(28);
    });
  });

  describe('calculateExitPosition', () => {
    it('calculates left exit position', () => {
      const pos = calculateExitPosition('left', 1000);
      expect(pos.x).toBe(-1200);
      expect(pos.y).toBe(0);
    });

    it('calculates right exit position', () => {
      const pos = calculateExitPosition('right', 1000);
      expect(pos.x).toBe(1200);
      expect(pos.y).toBe(0);
    });

    it('calculates skip exit position', () => {
      const pos = calculateExitPosition('skip', 1000);
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(-1000);
    });

    it('adjusts for viewport width', () => {
      const narrow = calculateExitPosition('left', 500);
      const wide = calculateExitPosition('left', 1500);
      expect(narrow.x).toBe(-700);
      expect(wide.x).toBe(-1700);
    });

    it('uses default viewport width', () => {
      const pos = calculateExitPosition('left');
      expect(pos.x).toBe(-1200);
    });
  });
});