import { timer } from '@actioncrew/streamix';

describe('TimerStream', () => {
  it('should emit values at specified interval', (done) => {
    const intervalMs = 100;
    const timerStream = timer(0, intervalMs); // Starting at 0 and emitting every intervalMs

    const emittedValues: number[] = [];
    const subscription = timerStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        // Check that values are emitted at the correct interval
        expect(emittedValues.length).toBeGreaterThan(1); // At least two emissions should be received
        for (let i = 1; i < emittedValues.length; i++) {
          expect(emittedValues[i] - emittedValues[i - 1]).toBe(1); // Values should increment by 1, indicating interval passes
        }

        done();
      }
    });

    setTimeout(() => {
      subscription.unsubscribe();
    }, 250); // Ensure subscription is stopped after some time
  });

  it('should stop emitting after unsubscribe', async () => {
    const intervalMs = 100;
    const timerStream = timer(0, intervalMs);

    const emittedValues: number[] = [];
    const subscription = timerStream.subscribe((value) => {
      emittedValues.push(value);
    });

    subscription.unsubscribe();

    const previousLength = emittedValues.length;
    await new Promise((resolve) => setTimeout(resolve, intervalMs * 2)); // Wait for potential additional emissions

    expect(emittedValues.length).toBe(previousLength); // No new emissions should occur after unsubscribe
  });
});
