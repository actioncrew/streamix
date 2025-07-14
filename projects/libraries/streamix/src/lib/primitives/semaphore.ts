type ReleaseFn = () => void;

export type Semaphore = {
  acquire: () => Promise<ReleaseFn>;
  tryAcquire: () => ReleaseFn | null;
  release: () => void; // Explicit release method
};

/**
 * Creates a semaphore for controlling access to a limited number of resources.
 *
 * @param {number} initialCount The initial number of permits available in the semaphore.
 * @returns {Semaphore} An object with methods to acquire, try to acquire, and release permits.
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
