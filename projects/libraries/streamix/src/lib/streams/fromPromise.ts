import { createStream, Stream } from "../abstractions";

/**
 * Converts a Promise into a Stream that emits the resolved value once and then completes.
 *
 * - Emits the resolved value of the promise.
 * - Emits an error if the promise rejects.
 */
export function fromPromise<T = any>(promise: Promise<T>): Stream<T> {
  return createStream(
    'fromPromise',
    async function* () {
      try {
        yield await promise;
      } catch (error) {
        throw error;
      }
    }
  );
}
