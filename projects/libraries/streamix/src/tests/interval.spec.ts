import { interval } from '@actioncrew/streamix';

describe('IntervalStream', () => {
  it('should emit values at specified interval', async () => {
    const intervalMs = 100;
    const intervalStream = interval(intervalMs);

    const emittedValues: number[] = [];
    const subscription = intervalStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        // Check that values are emitted at approximately the correct interval
        expect(emittedValues.length).toBeGreaterThan(1);
        for (let i = 1; i < emittedValues.length; i++) {
          const timeDiff = emittedValues[i] - emittedValues[i - 1];
          expect(timeDiff).toBeGreaterThanOrEqual(intervalMs - 10); // Allow for slight timing variations
          expect(timeDiff).toBeLessThanOrEqual(intervalMs + 10);
        }

        subscription.unsubscribe();
      }
    });
  });

  it('should stop emitting after unsubscribe', async () => {
    const intervalMs = 100;
    const intervalStream = interval(intervalMs);

    const emittedValues: number[] = [];
    const subscription = intervalStream.subscribe((value) => {
      emittedValues.push(value);
    });

    // Wait for a few intervals to ensure emissions
    await new Promise((resolve) => setTimeout(resolve, intervalMs * 3));

    subscription.unsubscribe(); // Unsubscribe after a few emissions

    const previousLength = emittedValues.length;
    await new Promise((resolve) => setTimeout(resolve, intervalMs * 2)); // Wait for potential additional emissions

    expect(emittedValues.length).toBe(previousLength); // No new emissions should occur after unsubscribe
  });

  it('should stop emitting after cancel', async () => {
    const intervalMs = 100;
    const intervalStream = interval(intervalMs);

    const emittedValues: number[] = [];
    const subscription = intervalStream.subscribe((value) => {
      emittedValues.push(value);
    });

    subscription.unsubscribe(); // Cancel after a few emissions

    const previousLength = emittedValues.length;
    await new Promise((resolve) => setTimeout(resolve, intervalMs * 2)); // Wait for potential additional emissions

    expect(emittedValues.length).toBe(previousLength); // No new emissions should occur after cancel
  });

  it('should emit immediately if interval is 0', (done) => {
    const intervalMs = 0;
    const intervalStream = interval(intervalMs);

    const emittedValues: number[] = [];
    const subscription = intervalStream.subscribe((value) => {
      emittedValues.push(value);
    });

    setTimeout(() => {
      expect(emittedValues.length).toBeGreaterThan(0);
      subscription.unsubscribe();
      done();
    }, 10)
  });

  it('should allow multiple subscriptions', async () => {
    const intervalMs = 100;
    const intervalStream = interval(intervalMs);

    const emittedValues1: number[] = [];
    const emittedValues2: number[] = [];

    const subscription1 = intervalStream.subscribe((value) => emittedValues1.push(value));
    const subscription2 = intervalStream.subscribe((value) => emittedValues2.push(value));

    // Wait for a few intervals to ensure emissions
    await new Promise((resolve) => setTimeout(resolve, intervalMs * 3));

    subscription1.unsubscribe();
    subscription2.unsubscribe();

    // Both subscriptions should have received the same values
    expect(emittedValues1).toEqual(emittedValues2);

    // Both should stop emitting after unsubscribed
    const previousLength1 = emittedValues1.length;
    const previousLength2 = emittedValues2.length;

    await new Promise((resolve) => setTimeout(resolve, intervalMs * 2)); // Wait for potential additional emissions

    expect(emittedValues1.length).toBe(previousLength1);
    expect(emittedValues2.length).toBe(previousLength2);
  });

  it('should emit at correct intervals and allow unsubscribe in a sequence', async () => {
    const intervalMs = 100;
    const intervalStream = interval(intervalMs);

    const emittedValues: number[] = [];
    const subscription = intervalStream.subscribe({
      next: (value) => emittedValues.push(value),
    });

    // Wait for first emission
    await new Promise((resolve) => setTimeout(resolve, intervalMs * 1.5));

    subscription.unsubscribe(); // Unsubscribe after first emission

    const firstLength = emittedValues.length;

    // Wait for potential additional emissions
    await new Promise((resolve) => setTimeout(resolve, intervalMs * 2));

    expect(emittedValues.length).toBe(firstLength); // No new emissions after unsubscribe
  });
});
