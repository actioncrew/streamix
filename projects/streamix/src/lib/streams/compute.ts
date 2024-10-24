import { createStream, Stream } from '../abstractions';
import { coroutine } from '../operators';

export function compute(task: ReturnType<typeof coroutine>, params: any): Stream<any> {
  // Create the custom run function for the ComputeStream
  const stream = createStream<any>(async function(this: Stream<any>): Promise<void> {
    let promise: Promise<void>;

    promise = new Promise<void>(async (resolve, reject) => {

      if (this.isRunning) {
        const worker = await task.getIdleWorker();
        worker.postMessage(params);

        // Handle messages from the worker
        worker.onmessage = async (event: any) => {
          await this.onEmission.process({ emission: { value: event.data }, source: this });
          task.returnWorker(worker);
          resolve();
        };

        // Handle errors from the worker
        worker.onerror = async (error: any) => {
          await this.onEmission.process({ emission: { isFailed: true, error }, source: this });
          task.returnWorker(worker);
          reject(error);
        };
      } else {
        resolve(); // Resolve immediately if not running
      }
    });

    try {
      await Promise.race([this.awaitCompletion(), promise]);
    } catch (error) {
      console.warn('Error during computation:', error);
    } finally {
      if (this.shouldComplete()) {
        await promise; // Wait for promise to resolve
        await this.complete(); // Complete the stream
      }
    }
  });

  // Create the stream using createStream and the custom run function
  return stream;
}
