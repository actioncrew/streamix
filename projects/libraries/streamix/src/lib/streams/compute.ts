import { createStream, PipelineContext, Stream } from "../abstractions";
import { Coroutine } from "../operators";

/**
 * Creates a stream that runs a computation task on a worker from a Coroutine pool,
 * yielding the result once the computation completes.
 *
 * This operator is designed for offloading CPU-intensive tasks to a background
 * thread, preventing the main thread from being blocked and keeping the UI
 * responsive. It uses a `Coroutine` to manage a pool of web workers.
 * The stream will emit a single value and then complete.
 *
 * @template T The type of the result from the computation.
 * @param {Coroutine} task The coroutine instance managing the worker pool.
 * @param {any} params The data to send to the worker for computation.
 * @returns {Stream<T>} A new stream that emits the result of the computation.
 */
export function compute<T = any>(task: Coroutine, params: any, context?: PipelineContext): Stream<T> {
  return createStream<T>("compute", async function* () {
    // Use processTask to handle worker acquisition, messaging, and releasing automatically
    const result = await task.processTask(params);
    yield result;
  }, context);
}
