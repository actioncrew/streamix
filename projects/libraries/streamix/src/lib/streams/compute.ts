import { createStream, Stream } from '../abstractions';
import { Coroutine } from '../operators';

/**
 * Creates a stream that runs a computation task on a worker from a Coroutine pool,
 * yielding the result once the computation completes.
 */
export function compute(task: Coroutine, params: any): Stream<any> {
  const controller = new AbortController();
  const signal = controller.signal;

  return createStream('compute', async function* () {
    // If aborted before starting
    if (signal.aborted) return;

    const worker = await task.getIdleWorker();

    try {
      const result = await new Promise<any>((resolve, reject) => {
        // Setup message handler
        worker.onmessage = (event: any) => {
          if (signal.aborted) return;
          if (event.data.error) {
            reject(event.data.error);
          } else {
            resolve(event.data);
          }
        };

        // Setup error handler
        worker.onerror = (error: any) => {
          if (signal.aborted) return;
          reject(error);
        };

        // Start the computation
        worker.postMessage(params);

        // Optional: handle abort to terminate worker early
        signal.addEventListener('abort', () => {
          // You might want to terminate the worker here or handle cleanup
          // worker.terminate(); // if safe to do so
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

      yield result;
    } finally {
      task.returnWorker(worker);
    }
  });
}
