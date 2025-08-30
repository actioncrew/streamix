import { createStream, PipelineContext, Stream } from "../abstractions";
import { Coroutine, CoroutineMessage } from "../operators/coroutine";

/**
 * Interface for a worker that has been "seized" from the coroutine pool.
 * It provides a persistent, bidirectional communication channel and a method
 * to release the worker back to the pool.
 *
 * @template T The type of data sent to the worker.
 * @template R The type of data returned from the worker.
 * @interface
 */
export interface SeizedWorker<T = any, R = T> {
  /** The unique identifier of the seized worker. */
  workerId: number;

  /**
   * Sends a task to the seized worker.
   * @param {T} data The data to be processed by the worker.
   * @returns {Promise<R>} A promise that resolves with the result from the worker.
   */
  sendTask: (data: T) => Promise<R>;

  /**
   * Releases the worker back to the pool.
   * This method must be called to free up the worker for other tasks.
   * After calling this, the `sendTask` method and event listeners will be defunct.
   */
  release: () => void;
}

/**
 * Creates a stream that "seizes" a single worker from the coroutine pool,
 * providing a persistent, manually-controlled communication channel.
 *
 * This operator is ideal for scenarios where you need to perform multiple,
 * sequential tasks on a specific, stateful worker. The worker remains
 * dedicated to the returned stream until the `release()` method is called
 * on the `SeizedWorker` object.
 *
 * The stream itself will only emit a single `SeizedWorker` object and then complete
 * after the worker has been released.
 *
 * @template T The type of data sent to the worker.
 * @template R The type of data returned from the worker.
 * @param {Coroutine<T, R>} task The coroutine instance managing the worker pool.
 * @param {(message: CoroutineMessage) => void} onMessage A callback function to handle messages received from the seized worker.
 * @param {(error: Error) => void} onError A callback function to handle errors originating from the seized worker.
 * @returns {Stream<SeizedWorker<T, R>>} A stream that yields a single `SeizedWorker` object.
 */
export function seize<T = any, R = T>(
  task: Coroutine<T, R>,
  onMessage: (message: CoroutineMessage) => void,
  onError: (error: Error) => void,
  context?: PipelineContext
): Stream<SeizedWorker> {
  return createStream("seize", async function* () {
    // Seize a worker from the pool
    const { worker, workerId } = await task.getIdleWorker();
    let disposed = false;

    // Setup worker message handler
    const messageHandler = (event: MessageEvent<CoroutineMessage>) => {
      const msg = event.data;
      if (msg.workerId === workerId) {
        // Pass the message to the provided callback
        onMessage(msg);
      }
    };
    worker.addEventListener('message', messageHandler);

    // Setup worker error handler
    const errorHandler = (event: ErrorEvent) => {
      // Pass the error to the provided callback
      onError(event.error);
    };
    worker.addEventListener('error', errorHandler);

    try {
      // Yield the seized worker interface
      yield {
        workerId,
        sendTask: (data: T) => task.assignTask(workerId, data),
        release: () => {
          if (!disposed) {
            disposed = true;
            worker.removeEventListener('message', messageHandler);
            worker.removeEventListener('error', errorHandler);
            task.returnWorker(workerId);
          }
        }
      };

      // Keep alive until disposed
      await new Promise<void>(() => {});
    } finally {
      if (!disposed) {
        worker.removeEventListener('message', messageHandler);
        worker.removeEventListener('error', errorHandler);
        task.returnWorker(workerId);
      }
    }
  }, context);
}
