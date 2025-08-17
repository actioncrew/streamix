/**
 * A function that releases a lock or a permit.
 * @callback ReleaseFn
 * @returns {void}
 */
export type ReleaseFn = () => void;

/**
 * An interface for a function that creates a simple asynchronous lock.
 *
 * @interface
 */
export type SimpleLock = () => Promise<ReleaseFn>;

/**
 * Creates a simple asynchronous lock mechanism. Only one caller can hold the lock at a time.
 * Subsequent calls will queue up and wait for the lock to be released. This is useful
 * for synchronizing access to shared resources in an asynchronous environment.
 *
 * The function returns a promise that resolves with a `ReleaseFn`. The caller must
 * invoke this function to release the lock, allowing the next queued caller to proceed.
 *
 * @returns {SimpleLock} A function that, when called, returns a promise to acquire the lock.
 */
export const createLock = (): SimpleLock => {
  let locked = false;
  const queue: Array<(release: ReleaseFn) => void> = [];

  return () =>
    new Promise<ReleaseFn>((resolve) => {
      const acquire = () => {
        if (!locked) {
          locked = true;
          resolve(() => {
            locked = false;
            if (queue.length > 0) {
              const next = queue.shift()!;
              next(acquire);
            }
          });
        } else {
          queue.push(acquire);
        }
      };
      acquire();
    });
};
