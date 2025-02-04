import { createEmission, createStream, Stream, Subscription } from '../abstractions';

export function merge<T = any>(...sources: Stream<T>[]): Stream<T> {
  const subscriptions: Subscription[] = [];
  const queue: T[] = [];
  let completedCount = 0;

  const stream = createStream<T>('merge', async function*(this: Stream<T>) {
    // Subscribe to each source stream and handle emissions and completion
    sources.forEach((source) => {
      const subscription = source.subscribe({
        next: (value) => queue.push(value),  // Collect emitted values in the queue
        complete: () => {
          completedCount++; // Increment completed count on each source completion
        },
      });
      subscriptions.push(subscription);
    });

    // Yield values from the queue as they become available
    while (completedCount < sources.length || queue.length > 0) {
      if (queue.length > 0) {
        yield createEmission({ value: queue.shift()! });
      } else {
        await new Promise(requestAnimationFrame); // Yield control and wait for next value
      }
    }
  });

  return stream;
}
