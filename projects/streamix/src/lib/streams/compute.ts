import { Consumer, createEmission, createStream, internals, Stream } from '../abstractions';
import { Coroutine } from '../operators';
import { catchAny } from '../utils';

export function compute(task: Coroutine, params: any): Stream<any> {
  // Create the custom run function for the ComputeStream
  const stream = createStream<any>('compute', async function(this: Stream<any>, c: Consumer): Promise<void> {
    let promise = new Promise<void>(async (resolve, reject) => {

      const worker = await task.getIdleWorker();
      worker.postMessage(params);

      // Handle messages from the worker
      worker.onmessage = async (event: any) => {
        if(event.data.error) {
          c.next(createEmission({ error: event.data.error }));
          task.returnWorker(worker);
          reject(event.data.error);
        } else {
          c.next(createEmission({ value: event.data }));
          task.returnWorker(worker);
          resolve();
        }
      };

      // Handle errors from the worker
      worker.onerror = async (error: any) => {
        task.returnWorker(worker);
        reject(error);
      };
    });

    const [error] = await catchAny(Promise.race([this[internals].awaitCompletion(), promise]));
    if (error) {
      c.next(createEmission({ error }));
      return;
    }
  });

  return stream;
}
