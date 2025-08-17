/**
 * Creates an asynchronous queue that processes operations sequentially.
 * Operations are guaranteed to run in the order they are enqueued, one after another.
 * This is useful for preventing race conditions and ensuring that dependent
 * asynchronous tasks are executed in a specific order.
 *
 * @returns {{ enqueue: (operation: () => Promise<any>) => Promise<any>, pending: number, isEmpty: boolean }} An object representing the queue.
 * @property {(operation: () => Promise<any>) => Promise<any>} enqueue Enqueues an asynchronous operation to be executed sequentially.
 * @property {number} pending The number of operations currently in the queue (including the one running).
 * @property {boolean} isEmpty A boolean indicating whether the queue is empty.
 */
export function createQueue() {
  let last = Promise.resolve();
  let pendingCount = 0;

  const enqueue = (operation: () => Promise<any>): Promise<any> => {
    pendingCount++;

    const result = last
      .then(() => operation())
      .finally(() => {
        pendingCount--;

        // Reset the call stack when queue is empty
        if (pendingCount === 0) {
          last = Promise.resolve();
        }
      });

    // Chain the next operation but handle errors to prevent queue lock
    last = result.catch(() => {});

    return result;
  };

  return {
    enqueue,
    // Utility methods for debugging/monitoring
    get pending() { return pendingCount; },
    get isEmpty() { return pendingCount === 0; }
  };
}
