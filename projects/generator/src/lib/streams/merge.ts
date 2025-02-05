import { createEmission, createStream, Stream, Subscription } from "../abstractions";
import { createSemaphore } from "../utils";

export function merge<T = any>(...sources: Stream<T>[]): Stream<T> {
  return createStream<T>('merge', async function* (this: Stream<T>) {
    const itemAvailable = createSemaphore(0); // Controls when an item is available
    const queue: T[] = [];
    let completedCount = 0;

    // Subscribe to each source and push emissions to the queue
    const subscriptions: Subscription[] = sources.map((source) =>
      source.subscribe({
        next: (value) => {
          queue.push(value);
          itemAvailable.release(); // Signal availability
        },
        complete: () => {
          completedCount++;
          itemAvailable.release(); // Ensure loop progresses when a source completes
        },
      })
    );

    // Yield values from the queue as they become available
    while (completedCount < sources.length || queue.length > 0) {
      await itemAvailable.acquire(); // Wait until an event is available

      if (queue.length > 0) {
        yield createEmission({ value: queue.shift()! });
      }
    }

    // Cleanup subscriptions
    subscriptions.forEach((sub) => sub.unsubscribe());
  });
}
