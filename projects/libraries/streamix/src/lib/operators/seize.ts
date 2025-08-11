import { createStream, Stream } from "../abstractions";
import { createSubject } from "../subjects";
import { Coroutine, CoroutineMessage } from "./coroutine";

/**
 * Interface for a worker that has been "seized" from the pool.
 * Provides a persistent, bidirectional communication channel
 * and a dispose method for releasing the worker back to the pool.
 */
export interface SeizedWorker<T = any, R = T> {
  outbound$: Stream<CoroutineMessage>;
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
  task: Coroutine<T, R>,
  initialParams?: T
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

    // Setup subject subscription to send messages to worker
    const subscription = subject.subscribe({
      next: (msg) => {
        if (!disposed) {
          worker.postMessage({
            ...msg,
            workerId: msg.workerId ?? workerId, // Ensure workerId is set
            messageId: msg.messageId ?? crypto.randomUUID(), // Ensure messageId
            type: msg.type ?? 'message' // Ensure type
          });
        }
      },
      complete: () => {
        if (!disposed) {
          worker.removeEventListener('message', messageHandler);
          task.returnWorker(worker);
        }
      }
    });

    try {
      // Process initial task if provided
      if (initialParams !== undefined) {
        const result = await task.assignTask(workerId, initialParams);
        subject.next({
          workerId,
          messageId: crypto.randomUUID(),
          type: 'response',
          payload: result
        });
      }

      // Yield the seized worker interface
      yield {
        outbound$: subject,
        sendTask: (data: T) => task.assignTask(workerId, data),
        dispose: () => {
          if (!disposed) {
            disposed = true;
            subscription.unsubscribe();
            worker.removeEventListener('message', messageHandler);
            task.returnWorker(worker);
            subject.complete();
          }
        }
      };

      // Keep alive until disposed
      await new Promise<void>(() => {});
    } finally {
      if (!disposed) {
        subscription.unsubscribe();
        worker.removeEventListener('message', messageHandler);
        task.returnWorker(worker);
      }
    }
  });
}
