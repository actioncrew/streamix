import { createStream, Stream } from '../abstractions';
import { Coroutine } from '../operators';

export function compute(task: Coroutine, params: any): Stream<any> {
  return createStream('compute', async function* () {
    const worker = await task.getIdleWorker();

    try {
      // Create a promise that resolves when we get a message
      const result = await new Promise<any>((resolve, reject) => {
        // Set up message handler
        worker.onmessage = (event: any) => {
          if (event.data.error) {
            reject(event.data.error);
          } else {
            resolve(event.data);
          }
        };

        // Set up error handler
        worker.onerror = (error: any) => {
          reject(error);
        };

        // Start the computation
        worker.postMessage(params);
      });

      // Yield the successful result
      yield result;
    } catch (error) {
      // Propagate any errors through the stream
      throw error;
    } finally {
      // Always return the worker to the pool
      task.returnWorker(worker);
    }
  });
}
