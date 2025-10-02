/**
 * Functional Scheduler
 *
 * Provides enqueue/run behavior without exposing internal mutable state.
 * State is held in a closure, and operations are returned as pure functions.
 */
export type Scheduler = {
  enqueue: (fn: () => Promise<any> | void) => Promise<any>;
  flush: () => Promise<any>; // manually drain if needed
};

/**
 * Creates a cooperative asynchronous scheduler that serializes operations
 * in a global queue.
 *
 * This scheduler ensures that tasks scheduled via `enqueue` are executed
 * in the order they were added, one at a time. If a task throws an error,
 * it is rethrown asynchronously to avoid blocking subsequent tasks in the queue.
 *
 * @returns {Scheduler} An object with methods to enqueue tasks and flush the queue.
 * @property {(fn: () => Promise<void> | void) => void} enqueue
 *   Adds a task to the queue. The task may be synchronous or asynchronous.
 * @property {() => Promise<void>} flush
 *   Waits until all scheduled tasks have completed execution.
 */
export function createScheduler(): Scheduler {
  let queue: (() => Promise<void> | void)[] = [];
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;

    while (queue.length > 0) {
      const fn = queue.shift()!;
      try {
        await fn();
      } catch (err) {
        setTimeout(() => { throw err; }, 0);
      }
    }

    running = false;
  };

  const enqueue = <T = void>(fn: () => Promise<T> | T): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      void run(); // trigger drain
    });
  };

  const flush = async () => {
    await run();
  };

  return { enqueue, flush };
}

export const scheduler = createScheduler();