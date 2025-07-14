/**
 * Creates an asynchronous queue that processes operations sequentially.
 * Operations are guaranteed to run in the order they are enqueued, one after another.
 *
 * @returns {object} An object containing the enqueue function and utility properties.
 * @property {(operation: () => Promise<any>) => Promise<any>} enqueue - Enqueues an asynchronous operation.
 * The operation will run after all previously enqueued operations have completed.
 * Returns a Promise that resolves with the result of the operation, or rejects if the operation throws an error.
 * @property {number} pending - A getter that returns the current number of pending operations in the queue.
 * @property {boolean} isEmpty - A getter that returns true if there are no pending operations in the queue, false otherwise.
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
