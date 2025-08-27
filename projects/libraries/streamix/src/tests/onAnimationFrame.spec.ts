import { map, onAnimationFrame, takeWhile } from '@actioncrew/streamix';

xdescribe('fromAnimationFrame - Functional Test', () => {

  it('should emit values at the expected rate', async () => {
    let emittedValues: any[] = [];
    let count = 0;
    // Subscribe to the stream to collect emitted values
    const stream = onAnimationFrame().pipe(map((_: any, index: any) => index), takeWhile(() => count < 5));

    stream.subscribe({
      next: (value: any) => {
        count++;
        emittedValues.push(value);
      },
      complete: () => {
        console.log('Stream completed.');
      },
    });

    // Allow the stream to run for a few frames
    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for a while to simulate animation frames

    // Check that we emitted the expected values
    expect(emittedValues).toEqual([0, 1, 2, 3, 4]); // Because the condition is value < 5
  });

  it('should stop when condition is met', (done) => {
    let emittedValues: any[] = [];
    let count = 0;
    // Subscribe to the stream to collect emitted values
    const stream = onAnimationFrame().pipe(takeWhile(() => count < 50));

    stream.subscribe({
      next: (value: any) => {
        count++;
        emittedValues.push(value);
      },
      complete: () => {
        // Assert that the stream stopped once the condition was met
        expect(emittedValues.length).toBe(50); // Stop emitting after reaching value >= 5
        done();
      },
    });
  });

  it('should handle infinite loop when condition is always true', async () => {
    let emittedValues: any[] = [];
    let count = 0;
    // Set condition to always true (infinite loop)
    const infiniteStream = onAnimationFrame().pipe(takeWhile(() => count <= 10));

    let subscription = infiniteStream.subscribe({
      next: (value: any) => {
        count++;
        emittedValues.push(value);
      },
      complete: () => {
        console.log('Infinite stream completed after 10 frames.');
        subscription.unsubscribe();
      },
    });

    // Wait for the loop to run a few frames and then complete
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Adjust time for the frames to emit

    // Ensure the stream emitted values and stopped after a set number of frames
    expect(emittedValues.length).toBe(11); // Expect 11 values: 0 to 10
    expect(emittedValues[0]).toBeLessThan(100); // First value should be 0
    expect(emittedValues[10]).toBeLessThan(100); // Last value should be 10
  });
});
