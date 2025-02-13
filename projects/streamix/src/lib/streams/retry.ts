import { createStream, Stream } from "../abstractions";
import { createSubject, Subject } from "../streams";
import { createSemaphore } from "../utils";

export function retry<T = any>(
  factory: () => Stream<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Stream<T> {
  return createStream<T>("retry", async function* (this: Stream<T>) {
    const sourceStream = factory();
    const itemAvailable = createSemaphore(0); // Semaphore for controlling flow
    const queue: T[] = []; // Queue to store emitted values
    let completed = false;
    let retryCount = 0;
    let errorEmitted = false; // Flag to track if error is emitted

    // Create a subject to handle emissions, errors, and completion
    const subject = createSubject<T>();

    // Helper function to handle retries
    const subscribeWithRetry = (sourceStream: Stream<T>) => {
      queue.length = 0;
      return sourceStream.subscribe({
        next: (value: T) => {
          queue.push(value); // Queue the value
          itemAvailable.release(); // Notify that an item is available
        },
        error: (error: any) => {
          if (retryCount < maxRetries) {
            retryCount++;
            // Wait before retrying the source stream
            setTimeout(() => {
              subscription.unsubscribe(); // Unsubscribe from current stream
              subscription = subscribeWithRetry(sourceStream); // Retry subscription
            }, delay);
          } else {
            // Emit the error after exceeding max retries
            if (!errorEmitted) {
              subject.error(error);
              errorEmitted = true; // Mark that error was emitted
            }
            completed = true; // Mark stream as completed due to error
            itemAvailable.release(); // Release semaphore to finish loop
          }
        },
        complete: () => {
          completed = true; // Mark stream as completed successfully
          itemAvailable.release(); // Ensure loop ends when stream completes
        },
      });
    };

    // Initial subscription to source stream
    let subscription = subscribeWithRetry(sourceStream);

    // Yield values sequentially only after successful completion
    while (!completed || queue.length > 0) {
      await itemAvailable.acquire(); // Wait for an item to be available

      // Emit values only after the stream successfully completes
      if (completed && !errorEmitted) {
        while (queue.length > 0) {
          subject.next(queue.shift()!); // Emit value to subject
        }
      }
    }

    if (completed) {
      subject.complete();
    }

    // Unsubscribe after processing
    subscription.unsubscribe();
  });
}
