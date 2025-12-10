import { describe, bench } from 'vitest';
import {
  calculateDragOpacity,
  calculateExitPosition,
  calculateLeftChoiceOpacity,
  calculateRightChoiceOpacity,
  calculateRotation,
  getPositionStyle,
} from './solution';

// Pre-generate test data
const positions = Array.from({ length: 10000 }, (_, i) => ({
  x: (Math.random() - 0.5) * 400,
  y: (Math.random() - 0.5) * 400,
}));

describe('Swipe Animation - Benchmarks', () => {
  describe('Individual functions', () => {
    bench('calculateDragOpacity - 100k calls', () => {
      for (let i = 0; i < 100000; i++) {
        calculateDragOpacity(i % 500 - 250, (i * 3) % 500 - 250);
      }
    });

    bench('calculateLeftChoiceOpacity - 100k calls', () => {
      for (let i = 0; i < 100000; i++) {
        calculateLeftChoiceOpacity(i % 300 - 200);
      }
    });

    bench('calculateRightChoiceOpacity - 100k calls', () => {
      for (let i = 0; i < 100000; i++) {
        calculateRightChoiceOpacity(i % 300 - 100);
      }
    });

    bench('calculateRotation - 100k calls', () => {
      for (let i = 0; i < 100000; i++) {
        calculateRotation(i % 400 - 200);
      }
    });

    bench('getPositionStyle - 100k calls', () => {
      const positions = [-1, 0, 1, 2] as const;
      for (let i = 0; i < 100000; i++) {
        getPositionStyle(positions[i % 4]);
      }
    });

    bench('calculateExitPosition - 100k calls', () => {
      const dirs = ['left', 'right', 'skip'] as const;
      for (let i = 0; i < 100000; i++) {
        calculateExitPosition(dirs[i % 3], 1000);
      }
    });
  });

  describe('Full animation frame', () => {
    bench('All calculations per frame - 10k frames', () => {
      for (const { x, y } of positions) {
        calculateDragOpacity(x, y);
        calculateLeftChoiceOpacity(x);
        calculateRightChoiceOpacity(x);
        calculateRotation(x);
      }
    });

    bench('60fps simulation (1000 frames)', () => {
      for (let frame = 0; frame < 1000; frame++) {
        const progress = frame / 1000;
        const x = -progress * 200;
        const y = Math.sin(progress * Math.PI) * 50;
        calculateDragOpacity(x, y);
        calculateLeftChoiceOpacity(x);
        calculateRotation(x);
      }
    });
  });
});