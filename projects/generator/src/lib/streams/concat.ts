import { createEmission, createStream, Stream } from "../abstractions";

export function concat<T = any>(...sources: Stream<T>[]): Stream<T> {
  return createStream<T>("concat", async function* () {
    for (const source of sources) {
      const queue: T[] = [];
      let completed = false;

      // Subscribe to the current source
      const subscription = source.subscribe({
        next: (value) => queue.push(value),  // Add emitted values to the queue
        complete: () => (completed = true),  // Mark source as completed
      });

      // Wrap the iterable in a generator to emit values sequentially
      yield* (async function* () {
        while (!completed || queue.length > 0) {
          if (queue.length > 0) {
            // Yield values from the current source
            yield createEmission({ value: queue.shift()! });
          } else {
            // Wait for the next value to be emitted
            await new Promise(requestAnimationFrame);
          }
        }
      })();

      // Unsubscribe when the source has completed
      subscription.unsubscribe();
    }
  });
}
