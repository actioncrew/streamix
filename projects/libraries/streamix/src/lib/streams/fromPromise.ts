import { createStream, PipelineContext, Stream } from "../abstractions";

/**
 * Creates a stream that emits the resolved value of a Promise and then completes.
 *
 * This is a simple but powerful operator for converting a single, asynchronous
 * value into a stream. If the promise is rejected, the stream will emit an
 * error. The stream will emit exactly one value before it completes.
 *
 * @template T The type of the value that the promise resolves to.
 * @param {Promise<T>} promise The promise to convert into a stream.
 * @returns {Stream<T>} A new stream that emits the resolved value of the promise.
 */
export function fromPromise<T = any>(promise: Promise<T>, context?: PipelineContext): Stream<T> {
  return createStream<T>('fromPromise', async function* () {
    yield await promise;
  }, context);
}
