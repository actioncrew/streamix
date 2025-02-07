import { createEmission, createStream, Stream } from "../abstractions";
import { createSemaphore } from "../utils";

export function concat<T = any>(...sources: Stream<T>[]): Stream<T> {
  return createStream<T>("concat", async function* (this: Stream<T>) {
    for (const source of sources) {
      const itemAvailable = createSemaphore(0); // Controls when items are available
      const queue: T[] = []; // Event queue
      let completed = false;

      // Subscribe to the source and collect its emissions
      const subscription = source.subscribe({
        next: (value) => {
          queue.push(value);
          itemAvailable.release(); // Signal that an item is available
        },
        complete: () => {
          completed = true; // Mark as completed when the stream finishes
          itemAvailable.release(); // Ensure loop doesn't hang if no values were emitted
        },
      });

      // Process queued values sequentially
      while (!completed || queue.length > 0) {
        await itemAvailable.acquire(); // Wait until an event is available

        if (queue.length > 0) {
          yield createEmission({ value: queue.shift()! });
        }
      }

      subscription.unsubscribe(); // Unsubscribe when done with this source
    }
  });
}
