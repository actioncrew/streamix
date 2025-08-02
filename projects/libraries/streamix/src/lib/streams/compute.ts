import { createStream, Stream } from '../abstractions';
import { Coroutine } from '../operators';

/**
 * Creates a stream that runs a computation task on a worker from a Coroutine pool,
 * yielding the result once the computation completes.
 */
export function compute<T = any>(task: Coroutine, params: any): Stream<T> {
  return createStream<T>('compute', async function* () {
    const worker = await task.getIdleWorker();

    try {
      const result = await new Promise<any>((resolve, reject) => {
        // Setup message handler
        worker.onmessage = (event: any) => {
          if (event.data.error) {
            reject(event.data.error);
          } else {
            resolve(event.data);
          }
        };

        // Setup error handler
        worker.onerror = (error: any) => {
          reject(error);
        };

        // Start the computation
        worker.postMessage(params);
      });

      yield result;
    } finally {
      task.returnWorker(worker);
    }
  });
}
