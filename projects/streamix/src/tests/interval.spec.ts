import { IntervalStream } from '../lib';

describe('IntervalStream', () => {
  it('should emit values at specified interval', async () => {
    const intervalMs = 100;
    const intervalStream = new IntervalStream(intervalMs);

    const emittedValues: number[] = [];
    const subscription = intervalStream.subscribe((value) => {
      emittedValues.push(value);
    });

    intervalStream.isStopped.then(() => {
      // Check that values are emitted at approximately the correct interval
      expect(emittedValues.length).toBeGreaterThan(1);
      for (let i = 1; i < emittedValues.length; i++) {
        const timeDiff = emittedValues[i] - emittedValues[i - 1];
        expect(timeDiff).toBeGreaterThanOrEqual(intervalMs - 10); // Allow for slight timing variations
        expect(timeDiff).toBeLessThanOrEqual(intervalMs + 10);
      }

      subscription.unsubscribe();
    });
  });

  it('should stop emitting after unsubscribe', async () => {
    const intervalMs = 100;
    const intervalStream = new IntervalStream(intervalMs);

    const emittedValues: number[] = [];
    const subscription = intervalStream.subscribe((value) => {
      emittedValues.push(value);
    });

    subscription.unsubscribe();

    const previousLength = emittedValues.length;
    await new Promise((resolve) => setTimeout(resolve, intervalMs * 2)); // Wait for potential additional emissions

    expect(emittedValues.length).toBe(previousLength); // No new emissions should occur after unsubscribe
  });

  it('should stop emitting after cancel', async () => {
    const intervalMs = 100;
    const intervalStream = new IntervalStream(intervalMs);

    const emittedValues: number[] = [];
    intervalStream.subscribe((value) => {
      emittedValues.push(value);
    });

    intervalStream.terminate();

    const previousLength = emittedValues.length;
    await new Promise((resolve) => setTimeout(resolve, intervalMs * 2)); // Wait for potential additional emissions

    expect(emittedValues.length).toBe(previousLength); // No new emissions should occur after cancel
  });
});
