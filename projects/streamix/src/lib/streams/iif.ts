import { createEmission, createStream, Stream } from "../abstractions";
import { createSemaphore } from "../utils";

export function iif<T = any>(
  condition: () => boolean,
  trueStream: Stream<T>,
  falseStream: Stream<T>
): Stream<T> {
  return createStream<T>("iif", async function* (this: Stream<T>) {
    const source = condition() ? trueStream : falseStream;
    const itemAvailable = createSemaphore(0); // Controls when items are available
    let latestValue: T | undefined;
    let completed = false;

    // Subscribe to the source and collect its emissions
    const subscription = source.subscribe({
      next: (value) => {
        latestValue = value;
        itemAvailable.release(); // Signal that an item is available
      },
      complete: () => {
        completed = true; // Mark as completed when the stream finishes
        itemAvailable.release(); // Ensure loop doesn't hang if no values were emitted
      },
    });

    // Process latest value only
    while (!completed || latestValue !== undefined) {
      await itemAvailable.acquire(); // Wait until an event is available

      if (latestValue !== undefined) {
        yield createEmission({ value: latestValue });
        latestValue = undefined; // Reset latest value after yielding it
      }
    }

    subscription.unsubscribe(); // Unsubscribe when done with this source
  });
}
