import { createStream, Stream } from "../abstractions";

/**
 * Retries a stream-producing factory function up to a given number of times
 * when an error occurs during execution.
 *
 * - Re-subscribes to the stream on error.
 * - Yields all emitted values upon successful completion.
 * - Delays between retries if specified.
 * - Supports cancellation via unsubscribe.
 */
export function retry<T = any>(
  factory: () => Stream<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Stream<T> {
  return createStream<T>("retry", async function* () {
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const sourceStream = factory();
        const values: T[] = [];
        let streamError: any = null;
        let completed = false;

        await new Promise<void>((resolve, reject) => {
          const subscription = sourceStream.subscribe({
            next: (value: T) => {
              values.push(value);
            },
            error: (err: any) => {
              streamError = err;
              reject(err);
            },
            complete: () => {
              completed = true;
              resolve();
              subscription.unsubscribe();
            },
          });
        });

        if (streamError) {
          throw streamError;
        }

        if (completed) {
          for (const value of values) {
            yield value;
          }
          break;
        }
      } catch (error) {
        retryCount++;
        if (retryCount > maxRetries) {
          throw error;
        }

        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }
  });
}
