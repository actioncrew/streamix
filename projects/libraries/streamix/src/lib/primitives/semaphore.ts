import { ReleaseFn } from "./lock";

/**
 * An interface for a semaphore, a synchronization primitive for controlling
 * access to a limited number of resources.
 *
 * @interface
 */
export type Semaphore = {
  /**
   * Acquires a permit from the semaphore. If no permits are available,
   * this promise-based method will block until a permit is released.
   *
   * @returns {Promise<ReleaseFn>} A promise that resolves with a function to call to release the permit.
   */
  acquire: () => Promise<ReleaseFn>;

  /**
   * Attempts to acquire a permit from the semaphore without blocking.
   *
   * @returns {ReleaseFn | null} A function to call to release the permit if one was acquired, otherwise `null`.
   */
  tryAcquire: () => ReleaseFn | null;

  /**
   * Releases a permit back to the semaphore. This unblocks the next waiting
   * `acquire` call in the queue or increments the available permit count.
   */
  release: () => void;
};

/**
 * Creates a semaphore for controlling access to a limited number of resources.
 *
 * A semaphore is a synchronization primitive that allows you to manage
 * concurrent access to resources by maintaining a count of available "permits."
 *
 * @param {number} initialCount The initial number of permits available. Must be a non-negative integer.
 * @returns {Semaphore} A semaphore object with `acquire`, `tryAcquire`, and `release` methods.
 */
export const createSemaphore = (initialCount: number): Semaphore => {
  let count = initialCount;
  const queue: Array<() => void> = []; // Stores functions that resolve the acquire promise

  const release = () => {
    if (queue.length > 0) {
      const next = queue.shift()!;
      next(); // Immediately execute the next acquire logic, passing the permit
    } else {
      count++; // Only increment count if no one is waiting
    }
  };

  const acquire = (): Promise<ReleaseFn> =>
    new Promise((resolve) => {
      if (count > 0) {
        count--;
        resolve(() => release()); // Resolve with a ReleaseFn that calls our internal release
      } else {
        // Store a function that will resolve this promise when unblocked
        queue.push(() => {
          // When this function is called, it means we've acquired a permit.
          // No need to decrement count here, as it was never incremented for this "queued" acquire.
          resolve(() => release());
        });
      }
    });

  const tryAcquire = (): ReleaseFn | null => {
    if (count > 0) {
      count--;
      return () => release();
    }
    return null;
  };

  return { acquire, tryAcquire, release };
};
