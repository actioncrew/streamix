import { createEmission, createStream, Stream } from "../abstractions";

export function concat<T = any>(...sources: Stream<T>[]): Stream<T> {
  return createStream<T>("concat", async function* () {
    // Process each source one by one in sequence
    for (const source of sources) {
      let completed = false;
      const queue: T[] = [];

      // Subscribe to the source and collect its emissions
      const subscription = source.subscribe({
        next: (value) => queue.push(value), // Collect emitted values in the queue
        complete: () => (completed = true),  // Mark as completed when source is done
      });

      // Yield values from the queue as they become available
      while (!completed || queue.length > 0) {
        if (queue.length > 0) {
          yield createEmission({ value: queue.shift()! });
        } else {
          await new Promise(requestAnimationFrame); // Yield control and wait for next value
        }
      }

      subscription.unsubscribe(); // Unsubscribe when done with this source
    }
  });
}
