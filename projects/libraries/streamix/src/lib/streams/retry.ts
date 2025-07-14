import { createStream, Stream } from "../abstractions";

/**
 * Retries a stream-producing factory function up to a given number of times
 * when an error occurs during execution.
 *
 * - Re-subscribes to the stream on error.
 * - Yields all emitted values upon successful completion.
 * - Delays between retries if specified.
 */
export function retry<T = any>(
  factory: () => Stream<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Stream<T> {
  return createStream<T>("retry", async function* (this: Stream<T>) {
    let retryCount = 0;
    let sourceStream: Stream<T> | null = null;

    while (retryCount <= maxRetries) {

      try {
        sourceStream = factory();
        const values: T[] = [];
        let streamError: any = null;
        let completed = false;

        // Create a promise that will resolve when the stream completes or errors
        await new Promise<void>((resolve, reject) => {
          const subscription = sourceStream!.subscribe({
            next: (value: T) => {
              values.push(value);
            },
            error: (err: any) => {
              streamError = err;
              reject(streamError);
            },
            complete: () => {
              completed = true;
              resolve();
              subscription.unsubscribe(); // Clean up subscription on completion
            }
          });
        });

        // If we have an error, throw it to trigger retry logic
        if (streamError) {
          throw streamError;
        }

        // If completed successfully, yield all collected values
        if (completed) {
          for (const value of values) {
            yield value;
          }
          break; // Exit retry loop on success
        }
      } catch (error) {
        retryCount++;

        if (retryCount > maxRetries) {
          throw error; // Rethrow after max retries
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  });
}
