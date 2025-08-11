import { createSubject, Subject } from "../subjects";
import { Coroutine, CoroutineMessage } from "./coroutine";

export interface SeizedWorker {
  subject: Subject<CoroutineMessage>;
  dispose: () => void;
}

/**
 * Seizes a single worker from the coroutine pool,
 * providing a persistent, manually-controlled communication channel.
 *
 * This function is ideal for scenarios where you need to perform multiple,
 * sequential tasks on a specific, stateful worker. The worker remains
 * dedicated to the returned SeizedWorker until the `dispose()` method is called.
 *
 * @param task The coroutine instance managing the worker pool.
 * @param initialParams Optional initial task to send to the worker upon seizing it.
 * @returns Promise resolving to the `SeizedWorker` object.
 */
export async function seize<T = any, R = T>(
  task: Coroutine<T, R>,
  initialParams?: T
): Promise<SeizedWorker> {
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
  worker.addEventListener("message", messageHandler);

  // Setup subject subscription to send messages to worker
  const subscription = subject.subscribe({
    next: (msg) => {
      if (!disposed) {
        worker.postMessage({
          ...msg,
          workerId: msg.workerId ?? workerId, // Ensure workerId is set
          messageId: msg.messageId ?? crypto.randomUUID(), // Ensure messageId
          type: msg.type ?? "message", // Ensure type
        });
      }
    },
    complete: () => {
      if (!disposed) {
        worker.removeEventListener("message", messageHandler);
        task.returnWorker(worker);
      }
    },
  });

  // Process initial task if provided
  if (initialParams !== undefined) {
    const result = await task.assignTask(workerId, initialParams);
    subject.next({
      workerId,
      messageId: crypto.randomUUID(),
      type: "response",
      payload: result,
    });
  }

  return {
    subject,
    dispose: () => {
      if (!disposed) {
        disposed = true;
        subscription.unsubscribe();
        worker.removeEventListener("message", messageHandler);
        task.returnWorker(worker);
        subject.complete();
      }
    },
  };
}
