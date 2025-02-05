import { timer } from '../lib';

describe('TimerStream', () => {
  it('should emit values at specified interval', async () => {
    const intervalMs = 100;
    const timerStream = timer(0, intervalMs);

    const emittedValues: number[] = [];
    timerStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        // Check that values are emitted at approximately the correct interval
        expect(emittedValues.length).toBeGreaterThan(1);
        for (let i = 1; i < emittedValues.length; i++) {
          const timeDiff = emittedValues[i] - emittedValues[i - 1];
          expect(timeDiff).toBeGreaterThanOrEqual(intervalMs - 10); // Allow for slight timing variations
          expect(timeDiff).toBeLessThanOrEqual(intervalMs + 10);
        }
      }
    });
  });
});
