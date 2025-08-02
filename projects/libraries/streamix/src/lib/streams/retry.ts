import { createStream, Stream } from "../abstractions";

/**
 * Creates a stream that subscribes to a source factory and retries on error.
 *
 * This operator is useful for handling streams that may fail due to
 * temporary issues, such as network problems. It will attempt to
 * resubscribe to the source stream up to `maxRetries` times, with an
 * optional delay between each attempt.
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
