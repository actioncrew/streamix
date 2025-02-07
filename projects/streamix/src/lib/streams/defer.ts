import { createEmission, createStream, Stream } from "../abstractions";
import { createSemaphore } from "../utils";

export function defer<T = any>(factory: () => Stream<T>): Stream<T> {
  return createStream<T>('defer', async function* (this: Stream<T>) {
    const innerStream = factory(); // Create the inner stream from the factory

    const itemAvailable = createSemaphore(0); // Controls when items are available
    const queue: T[] = []; // Event queue
    let completed = false;

    // Subscribe to the inner stream
    const subscription = innerStream.subscribe({
      next: (value: T) => {
        queue.push(value);
        itemAvailable.release(); // Signal that an item is available
      },
      complete: () => {
        completed = true; // Mark as completed when the stream finishes
        itemAvailable.release(); // Ensure loop doesn't hang if no values were emitted
      },
    });

    // Yield values sequentially
    while (!completed || queue.length > 0) {
      await itemAvailable.acquire(); // Wait until an event is available

      if (queue.length > 0) {
        yield createEmission({ value: queue.shift()! });
      }
    }

    subscription.unsubscribe(); // Unsubscribe when done with the inner stream
  });
}
