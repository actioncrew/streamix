import { createStream, Stream } from '../abstractions';
import { coroutine } from '../operators';
import { catchAny } from '../utils';

export function compute(task: ReturnType<typeof coroutine>, params: any): Stream<any> {
  // Create the custom run function for the ComputeStream
  const stream = createStream<any>(async function(this: Stream<any>): Promise<void> {
    let promise: Promise<void>;

    promise = new Promise<void>(async (resolve, reject) => {

      const worker = await task.getIdleWorker();
      worker.postMessage(params);

      // Handle messages from the worker
      worker.onmessage = async (event: any) => {
        if(event.data.error) {
          task.returnWorker(worker);
          reject(event.data.error);
        } else {
          await this.onEmission.parallel({ emission: { value: event.data }, source: this });
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

    const [error] = await catchAny(Promise.race([this.awaitCompletion(), promise]));
    if(error) {
      this.onError.parallel({ error });
    } else if (this.shouldComplete()) {
      await promise;
    }

    return promise;
  });

  stream.name = "compute";
  // Create the stream using createStream and the custom run function
  return stream;
}
