import { createEmission, createStream, Stream } from "../abstractions";
import { createSemaphore } from "../utils";

export function retry<T = any>(
  factory: () => Stream<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Stream<T> {
  return createStream<T>("retry", async function* (this: Stream<T>) {
    const sourceStream = factory();
    const itemAvailable = createSemaphore(0); // Controls when items are available
    const queue: T[] = []; // Event queue
    let completed = false;
    let retryCount = 0;

    // Subscribe to the source stream
    const subscription = sourceStream.subscribe({
      next: (value: T) => {
        queue.push(value);
        itemAvailable.release(); // Signal that an item is available
      },
      error: (error: any) => {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(() => {
            // Resubscribe to the source stream after the delay
            subscription.unsubscribe();
            const newSubscription = sourceStream.subscribe({
              next: (value: T) => {
                queue.push(value);
                itemAvailable.release();
              },
              error: (error: any) => {
                // Retry again or give up if max retries are exhausted
                if (retryCount >= maxRetries) {
                  this.error(error); // Emit the error if max retries are exhausted
                }
              },
              complete: () => {
                completed = true;
                itemAvailable.release();
              },
            });
            subscription = newSubscription; // Update the subscription reference
          }, delay);
        } else {
          this.error(error); // Emit the error if max retries are exhausted
        }
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

    subscription.unsubscribe(); // Unsubscribe when done with the source stream
  });
}
