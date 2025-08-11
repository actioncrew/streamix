import { createStream, Stream } from "../abstractions";
import { Coroutine, CoroutineMessage } from "../operators";

/**
 * Creates a stream that runs a computation task on a worker from a Coroutine pool,
 * yielding the result once the computation completes.
 *
 * This operator is designed for offloading CPU-intensive tasks to a background
 * thread, preventing the main thread from being blocked and keeping the UI
 * responsive. It uses a `Coroutine` to manage a pool of web workers.
 */
export function compute<T = any>(task: Coroutine, params: any): Stream<T> {
  return createStream<T>("compute", async function* () {
    const { worker, workerId } = await task.getIdleWorker();
    (worker as any).__id = workerId;
    const messageId = crypto.randomUUID();

    try {
      const result = await new Promise<any>((resolve, reject) => {
        const messageHandler = (event: MessageEvent<CoroutineMessage>) => {
          if (event.data.messageId !== messageId) return;
          worker.removeEventListener("message", messageHandler);
          worker.removeEventListener("error", errorHandler);
          if (event.data.error) reject(new Error(event.data.error));
          else resolve(event.data.payload);
        };

        const errorHandler = (error: ErrorEvent) => {
          worker.removeEventListener("message", messageHandler);
          worker.removeEventListener("error", errorHandler);
          reject(new Error(error.message));
        };

        worker.addEventListener("message", messageHandler);
        worker.addEventListener("error", errorHandler);
        worker.postMessage({ workerId, messageId, payload: params });
      });

      yield result;
    } finally {
      task.returnWorker(worker);
    }
  });
}
