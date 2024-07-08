export class Lock {
  /**
   * Flag indicating whether the lock is currently acquired by someone.
   */
  public isLocked: boolean = false;

  /**
   * Internal queue to store waiting promises when the lock is acquired.
   */
  private queue: Array<() => void> = [];

  /**
   * Constructor (no arguments needed for initialization).
   */
  constructor() {}

  /**
   * Asynchronously acquires the lock.
   *
   * @returns {Promise<void>}  - A promise that resolves immediately if the lock is not acquired,
   *                             or resolves later when the lock becomes available for the caller.
   */
  public async acquire(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isLocked) {
        this.isLocked = true;
        resolve(); // Lock acquired, resolve the promise
      } else {
        this.queue.push(() => resolve()); // Add resolve to queue
      }
    });
  }

  /**
   * Releases the lock, allowing the next waiting promise in the queue to acquire it.
   */
  release() {
    this.isLocked = false;
    // Process the waiting requests (if any)
    if (this.queue.length > 0) {
      const nextResolve = this.queue.shift()!;
      nextResolve(); // Resolve the first waiting promise
    };
  }
}
