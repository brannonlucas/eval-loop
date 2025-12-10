import { describe, expect, it } from "vitest";
import {
  type GestureThresholds,
  getDominantDirection,
  isFastFlick,
  isHorizontalDominant,
  isSlowDrag,
  isVerticalDominant,
  processSwipeGesture,
} from "./solution";

describe("swipe-gesture", () => {
  describe("isSlowDrag", () => {
    it("returns true when both axes below threshold", () => {
      expect(isSlowDrag({ x: 50, y: 50 }, 200)).toBe(true);
    });

    it("returns false when x exceeds threshold", () => {
      expect(isSlowDrag({ x: 250, y: 50 }, 200)).toBe(false);
    });

    it("returns false when y exceeds threshold", () => {
      expect(isSlowDrag({ x: 50, y: 250 }, 200)).toBe(false);
    });

    it("handles negative velocities", () => {
      expect(isSlowDrag({ x: -50, y: -50 }, 200)).toBe(true);
      expect(isSlowDrag({ x: -250, y: 50 }, 200)).toBe(false);
    });
  });

  describe("isFastFlick", () => {
    it("returns true when velocity exceeds threshold", () => {
      expect(isFastFlick(600, 500)).toBe(true);
    });

    it("returns false when velocity below threshold", () => {
      expect(isFastFlick(400, 500)).toBe(false);
    });

    it("handles negative velocity", () => {
      expect(isFastFlick(-600, 500)).toBe(true);
      expect(isFastFlick(-400, 500)).toBe(false);
    });
  });

  describe("isHorizontalDominant", () => {
    it("returns true when x exceeds biased y", () => {
      expect(isHorizontalDominant({ x: 100, y: 50 }, 1.5)).toBe(true);
    });

    it("returns false when y is dominant", () => {
      expect(isHorizontalDominant({ x: 50, y: 100 }, 1.5)).toBe(false);
    });

    it("returns false when equal (bias makes y win)", () => {
      expect(isHorizontalDominant({ x: 75, y: 50 }, 1.5)).toBe(false);
    });

    it("handles negative values", () => {
      expect(isHorizontalDominant({ x: -100, y: 50 }, 1.5)).toBe(true);
      expect(isHorizontalDominant({ x: 100, y: -50 }, 1.5)).toBe(true);
    });
  });

  describe("isVerticalDominant", () => {
    it("returns true when y exceeds x", () => {
      expect(isVerticalDominant({ x: 50, y: 100 })).toBe(true);
    });

    it("returns false when x exceeds y", () => {
      expect(isVerticalDominant({ x: 100, y: 50 })).toBe(false);
    });

    it("returns false when equal", () => {
      expect(isVerticalDominant({ x: 100, y: 100 })).toBe(false);
    });
  });

  describe("getDominantDirection", () => {
    it("returns horizontal when x dominant with bias", () => {
      expect(getDominantDirection({ x: 100, y: 50 }, 1.5)).toBe("horizontal");
    });

    it("returns vertical when y dominant", () => {
      expect(getDominantDirection({ x: 50, y: 100 }, 1.5)).toBe("vertical");
    });

    it("returns none when neither dominant", () => {
      expect(getDominantDirection({ x: 0, y: 0 }, 1.5)).toBe("none");
    });
  });

  describe("processSwipeGesture", () => {
    const thresholds: GestureThresholds = {
      slowDragVelocity: 200,
      fastFlickVelocity: 500,
      offsetThreshold: 60,
      horizontalBias: 1.5,
    };

    describe("horizontal swipes", () => {
      it("detects left swipe with fast flick", () => {
        const result = processSwipeGesture({ x: -80, y: 0 }, { x: -600, y: 0 }, true, thresholds);
        expect(result).toEqual({ direction: "left", shouldSpringBack: false });
      });

      it("detects right swipe with fast flick", () => {
        const result = processSwipeGesture({ x: 80, y: 0 }, { x: 600, y: 0 }, true, thresholds);
        expect(result).toEqual({ direction: "right", shouldSpringBack: false });
      });

      it("detects left swipe with deliberate drag", () => {
        const result = processSwipeGesture(
          { x: -80, y: 0 },
          { x: -300, y: 0 },
          true,
          thresholds
        );
        expect(result).toEqual({ direction: "left", shouldSpringBack: false });
      });

      it("detects swipe with very large offset even if slow", () => {
        const result = processSwipeGesture(
          { x: -100, y: 0 },
          { x: -50, y: 0 },
          true,
          thresholds
        );
        expect(result).toEqual({ direction: "left", shouldSpringBack: false });
      });

      it("springs back when slow and insufficient offset", () => {
        const result = processSwipeGesture(
          { x: -50, y: 0 },
          { x: -100, y: 0 },
          true,
          thresholds
        );
        expect(result).toEqual({ direction: null, shouldSpringBack: true });
      });
    });

    describe("skip swipes (vertical up)", () => {
      it("detects skip with fast flick when canSwipeUp", () => {
        const result = processSwipeGesture({ x: 0, y: -80 }, { x: 0, y: -600 }, true, thresholds);
        expect(result).toEqual({ direction: "skip", shouldSpringBack: false });
      });

      it("detects skip with fast flick even when NOT canSwipeUp", () => {
        const result = processSwipeGesture({ x: 0, y: -80 }, { x: 0, y: -600 }, false, thresholds);
        expect(result).toEqual({ direction: "skip", shouldSpringBack: false });
      });

      it("detects skip with deliberate drag when canSwipeUp", () => {
        const result = processSwipeGesture({ x: 0, y: -80 }, { x: 0, y: -300 }, true, thresholds);
        expect(result).toEqual({ direction: "skip", shouldSpringBack: false });
      });

      it("springs back on deliberate drag when NOT canSwipeUp", () => {
        const result = processSwipeGesture({ x: 0, y: -80 }, { x: 0, y: -300 }, false, thresholds);
        expect(result).toEqual({ direction: null, shouldSpringBack: true });
      });

      it("ignores downward swipes", () => {
        const result = processSwipeGesture({ x: 0, y: 80 }, { x: 0, y: 600 }, true, thresholds);
        expect(result).toEqual({ direction: null, shouldSpringBack: true });
      });
    });

    describe("edge cases", () => {
      it("uses default thresholds when not provided", () => {
        const result = processSwipeGesture({ x: -100, y: 0 }, { x: -600, y: 0 }, true);
        expect(result.direction).toBe("left");
      });

      it("springs back on zero movement", () => {
        const result = processSwipeGesture({ x: 0, y: 0 }, { x: 0, y: 0 }, true, thresholds);
        expect(result).toEqual({ direction: null, shouldSpringBack: true });
      });

      it("prefers horizontal when biased direction is ambiguous", () => {
        const result = processSwipeGesture(
          { x: -100, y: -60 },
          { x: -600, y: -400 },
          true,
          thresholds
        );
        expect(result.direction).toBe("left");
      });
    });
  });
});