import { createStream, Stream } from "../abstractions";
import { Coroutine, CoroutineMessage } from "./coroutine";

/**
 * Interface for a worker that has been "seized" from the pool.
 * Provides a persistent, bidirectional communication channel
 * and a dispose method for releasing the worker back to the pool.
 */
export interface SeizedWorker<T = any, R = T> {
  workerId: number;
  sendTask: (data: T) => Promise<R>;
  release: () => void;
}

/**
 * Creates a stream that "seizes" a single worker from the coroutine pool,
 * providing a persistent, manually-controlled communication channel.
 *
 * This operator is ideal for scenarios where you need to perform multiple,
 * sequential tasks on a specific, stateful worker. The worker remains
 * dedicated to the returned stream until the `dispose()` method is called
 * on the `SeizedWorker` object.
 *
 * @param task The coroutine instance managing the worker pool.
 * @param onMessage A callback to handle messages from the seized worker.
 * @param onError A callback to handle errors from the seized worker.
 * @returns A stream that yields a single `SeizedWorker` object.
 */
export function seize<T = any, R = T>(
  task: Coroutine<T, R>,
  onMessage: (message: CoroutineMessage) => void,
  onError: (error: Error) => void
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
  });
}
