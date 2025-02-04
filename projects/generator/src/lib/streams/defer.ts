import { createEmission, createStream, Stream } from '../abstractions';

export function defer<T = any>(factory: () => Stream<T>): Stream<T> {
  return createStream<T>('defer', async function* (this: Stream<T>) {
    let innerStream = factory(); // Create the inner stream from the factory

    const queue: T[] = [];
    let completed = false;

    // Subscribe to the inner stream
    const subscription = innerStream.subscribe({
      next: (value: T) => queue.push(value), // Push emitted values to the queue
      complete: () => {
        completed = true; // Mark as completed once the inner stream completes
      },
    });

    // Yield values from the inner stream sequentially
    while (!completed || queue.length > 0) {
      if (queue.length > 0) {
        yield createEmission({ value: queue.shift()! }); // Yield value from the queue
      } else {
        await new Promise(requestAnimationFrame); // Wait for new values to be emitted
      }
    }

    subscription.unsubscribe(); // Unsubscribe once the inner stream is completed
  });
}
