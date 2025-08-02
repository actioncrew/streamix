import { createStream, Stream } from "../abstractions";

/**
 * Creates a stream that emits the resolved value of a Promise and then completes.
 *
 * This is a simple but powerful operator for converting a single, asynchronous
 * value into a stream. If the promise is rejected, the stream will emit an
 * error.
 */
export function fromPromise<T = any>(promise: Promise<T>): Stream<T> {
  return createStream<T>('fromPromise', async function* () {
    yield await promise;
  });
}
