import { Stream, createStream } from '../abstractions';
import { Coroutine } from '../operators';

export function compute(task: Coroutine, params: any): Stream<any> {
  return createStream('compute', async function* () {
    const worker = await task.getIdleWorker();
    let resolver: () => void;
    let rejecter: (error: any) => void;

    const promise = new Promise<void>((resolve, reject) => {
      resolver = resolve;
      rejecter = reject;
    });

    // Handle messages from the worker
    worker.onmessage = async (event: any) => {
      if (event.data.error) {
        task.returnWorker(worker);
        rejecter(event.data.error);
      } else {
        task.returnWorker(worker);
        resolver();
        return event.data; // This won't work - we need to fix this
      }
    };

    // Handle errors from the worker
    worker.onerror = async (error: any) => {
      task.returnWorker(worker);
      rejecter(error);
    };

    worker.postMessage(params);

    try {
      await promise;
      // We need another way to get the value here
    } catch (error) {
      throw error;
    }
  });
}
