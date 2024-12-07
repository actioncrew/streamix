import { fromAnimationFrame, eventBus } from '../lib';

describe('fromAnimationFrame - Functional Test', () => {

  it('should emit values at the expected rate', async () => {
    let emittedValues: any[] = [];
    // Subscribe to the stream to collect emitted values
    const stream = fromAnimationFrame<number>(
      0, // Initial value
      (value) => value < 5, // Stop condition: stop when value reaches 5
      (value, elapsedTime) => value + 1 // Increment value by 1 each frame
    );

    stream.subscribe({
      next: (value) => {
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

  it('should stop when condition is met', async () => {
    let emittedValues: any[] = [];
    // Subscribe to the stream to collect emitted values
    const stream = fromAnimationFrame<number>(
      0, // Initial value
      (value) => value < 5, // Stop condition: stop when value reaches 5
      (value, elapsedTime) => value + 1 // Increment value by 1 each frame
    );

    stream.subscribe({
      next: (value) => {
        emittedValues.push(value);
      },
      complete: () => {
        console.log('Stream completed.');
      },
    });

    // Allow the stream to run for a few frames
    await new Promise((resolve) => setTimeout(resolve, 50)); // Wait for a while to simulate animation frames

    // Assert that the stream stopped once the condition was met
    expect(emittedValues.length).toBeLessThanOrEqual(5); // Stop emitting after reaching value >= 5
  });

  it('should handle infinite loop when condition is always true', async () => {
    let emittedValues: any[] = [];

    // Set condition to always true (infinite loop)
    const infiniteStream = fromAnimationFrame<number>(
      0, // Initial value
      () => true, // Always true condition for infinite loop
      (value, elapsedTime) => value + 1 // Increment value by 1 each frame
    );

    let completed = false;

    infiniteStream.subscribe({
      next: (value) => {
        emittedValues.push(value);
        if (value >= 10 && !completed) {
          completed = true;
          infiniteStream.complete(); // Stop the stream after a few emissions
        }
      },
      complete: () => {
        console.log('Infinite stream completed after 10 frames.');
      },
    });

    // Wait for the loop to run a few frames and then complete
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Adjust time for the frames to emit

    // Ensure the stream emitted values and stopped after a set number of frames
    expect(emittedValues).toHaveLength(11); // Expect 11 values: 0 to 10
    expect(emittedValues[0]).toBe(0); // First value should be 0
    expect(emittedValues[10]).toBe(10); // Last value should be 10
  });
});
