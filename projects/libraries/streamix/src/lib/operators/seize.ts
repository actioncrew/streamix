import { createStream, Stream } from "../abstractions";
import { createSubject } from "../subjects";
import { Coroutine, CoroutineMessage } from "./coroutine";

/**
 * Interface for a worker that has been "seized" from the pool.
 * Provides a persistent, bidirectional communication channel
 * and a dispose method for releasing the worker back to the pool.
 */
export interface SeizedWorker<T = any, R = T> {
  workerId: number;
  output$: Stream<CoroutineMessage>;
  sendTask: (data: T) => Promise<R>,
  dispose: () => void;
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
 * @param initialParams Optional initial task to send to the worker upon seizing it.
 * @returns A stream that yields a single `SeizedWorker` object.
 */
export function seize<T = any, R = T>(
  task: Coroutine<T, R>
): Stream<SeizedWorker> {
  return createStream("seize", async function* () {
    // Seize a worker from the pool
    const { worker, workerId } = await task.getIdleWorker();
    let disposed = false;

    // Create our communication subject
    const subject = createSubject<CoroutineMessage>();

    // Setup worker message handler
    const messageHandler = (event: MessageEvent<CoroutineMessage>) => {
      const msg = event.data;
      if (msg.workerId === workerId) {
        subject.next(msg);
      }
    };
    worker.addEventListener('message', messageHandler);

    try {
      // Yield the seized worker interface
      yield {
        output$: subject,
        workerId,
        sendTask: (data: T) => task.assignTask(workerId, data),
        dispose: () => {
          if (!disposed) {
            disposed = true;
            worker.removeEventListener('message', messageHandler);
            task.returnWorker(workerId);
            subject.complete();
          }
        }
      };

      // Keep alive until disposed
      await new Promise<void>(() => {});
    } finally {
      if (!disposed) {
        worker.removeEventListener('message', messageHandler);
        task.returnWorker(workerId);
      }
    }
  });
}
