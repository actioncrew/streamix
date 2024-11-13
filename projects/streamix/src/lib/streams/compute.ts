import { createStream, Stream } from '../abstractions';
import { coroutine } from '../operators';
import { catchAny } from '../utils';
import { eventBus } from './bus';

export function compute(task: ReturnType<typeof coroutine>, params: any): Stream<any> {
  // Create the custom run function for the ComputeStream
  const stream = createStream<any>(async function(this: Stream<any>): Promise<void> {
    let promise = new Promise<void>(async (resolve, reject) => {

      const worker = await task.getIdleWorker();
      worker.postMessage(params);

      // Handle messages from the worker
      worker.onmessage = async (event: any) => {
        if(event.data.error) {
          task.returnWorker(worker);
          reject(event.data.error);
        } else {
          eventBus.enqueue({ target: this, payload: { emission: { value: event.data }, source: this }, type: 'emission' });
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

    this.onComplete.once(() => {
      this.isAutoComplete = true;
    });

    const [error] = await catchAny(Promise.race([this.awaitCompletion(), promise]));
    if(error) {
      eventBus.enqueue({ target: this, payload: { emission: { error, isFailed: true }, source: this }, type: 'emission' });
    } else {
      await promise;
    }

    return promise;
  });

  stream.name = "compute";
  return stream;
}
