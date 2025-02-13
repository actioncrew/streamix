import { createEmission, createStream, Stream } from "../abstractions";
import { createSemaphore } from "../utils";
import { Subject } from "../abstractions";

// Retry logic that uses a Subject for value emission
export function retry<T = any>(
  factory: () => Stream<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Stream<T> {
  return createStream<T>("retry", async function* (this: Stream<T>) {
    const sourceStream = factory();
    const subject: Subject<T> = createSubject<T>(); // Use subject for emission
    const itemAvailable = createSemaphore(0); // Semaphore to handle item flow
    const queue: T[] = []; // Queue to manage emitted values
    let completed = false;
    let retryCount = 0;

    // Function to handle retries
    const subscribeWithRetry = (sourceStream: Stream<T>) => {
      return sourceStream.subscribe({
        next: (value: T) => {
          queue.push(value);
          itemAvailable.release(); // Signal an item is available
        },
        error: (error: any) => {
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(() => {
              // Resubscribe to the source stream after the delay
              subscription.unsubscribe();
              subscribeWithRetry(sourceStream);
            }, delay);
          } else {
            subject.error(error); // Emit the error if max retries are exhausted
          }
        },
        complete: () => {
          completed = true;
          itemAvailable.release(); // Ensure loop finishes
        },
      });
    };

    // Initial subscription to the source stream
    let subscription = subscribeWithRetry(sourceStream);

    // Yield values sequentially
    while (!completed || queue.length > 0) {
      await itemAvailable.acquire(); // Wait until an item is available

      if (queue.length > 0) {
        // Emit the value using the subject
        subject.next(queue.shift()!);
      }
    }

    // Complete the subject when done
    subject.complete();
    subscription.unsubscribe(); // Ensure we unsubscribe once done
  });
}
