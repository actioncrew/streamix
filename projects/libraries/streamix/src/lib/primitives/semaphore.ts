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
  const queue: Array<() => void> = [];

  const release = () => {
    if (queue.length > 0) {
      // Don't call the resolver immediately - schedule it as a microtask
      // to maintain the expected order of execution
      const nextResolver = queue.shift()!;
      Promise.resolve().then(() => {
        nextResolver();
      });
    } else {
      count++;
    }
  };

  const acquire = (): Promise<ReleaseFn> =>
    new Promise((resolve) => {
      const resolverFn = () => resolve(() => release());

      if (count > 0) {
        count--;
        resolverFn();
      } else {
        queue.push(resolverFn);
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