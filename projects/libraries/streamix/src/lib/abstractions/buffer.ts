export type ReleaseFn = () => void;
export type SimpleLock = () => Promise<ReleaseFn>;

/**
 * Creates a simple asynchronous lock mechanism. Only one caller can hold the lock at a time.
 * Subsequent calls will queue up and wait for the lock to be released.
 *
 * @returns {SimpleLock} A function that, when called, attempts to acquire the lock.
 * If successful, it returns a Promise that resolves with a `ReleaseFn` to release the lock.
 * If the lock is held, the Promise will await until the lock becomes available.
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

export type CyclicBuffer<T = any> = {
  write: (item: T) => Promise<void>;
  error(error: Error): Promise<void>;
  read: (readerId: number) => Promise<{ value: T | undefined, done: boolean }>;
  peek: () => Promise<T | undefined>;
  attachReader: () => Promise<number>;
  detachReader: (readerId: number) => Promise<void>;
  complete: () => Promise<void>;
  completed: (readerId: number) => boolean;
};

export type SingleValueBuffer<T = any> = CyclicBuffer<T> & {
  getValue(): Promise<T | undefined>;
  get value(): T | undefined;
};

/**
 * Creates a single-value buffer (effectively a buffer with capacity 1).
 * This buffer ensures that a new value can only be written once all currently active readers have consumed the previous value.
 * It provides backpressure by waiting for readers to process the current value before allowing a new one.
 *
 * @template T The type of items stored in the buffer.
 * @param {T | undefined} [initialValue=undefined] An optional initial value for the buffer.
 * @returns {SingleValueBuffer<T>} A buffer implementation for a single value.
 */
export function createSingleValueBuffer<T = any>(initialValue: T | undefined = undefined): SingleValueBuffer<T> {
  let value: T | undefined = initialValue;
  let error: Error | undefined = undefined;
  let isCompleted = false;
  let version = initialValue !== undefined ? 1 : 0;

  const readers = new Map<number, {
    lastSeenVersion: number;
    isActive: boolean;
  }>();

  let nextReaderId = 0;
  const waitingReaders: (() => void)[] = [];
  const lock = createLock();

  const notifyReaders = () => {
    const toNotify = [...waitingReaders];
    waitingReaders.length = 0;
    toNotify.forEach(resolve => resolve());
  };

  const write = async (item: T): Promise<void> => {
    const releaseLock = await lock();
    try {
      if (isCompleted) throw new Error("Cannot write to completed buffer");
      if (error) throw new Error("Cannot write after error");

      value = item;
      error = undefined;
      version++;
      notifyReaders();
    } finally {
      releaseLock();
    }
  };

  const writeError = async (err: Error): Promise<void> => {
    const releaseLock = await lock();
    try {
      if (isCompleted) throw new Error("Cannot write error to completed buffer");

      error = err;
      value = undefined;
      version++;
      notifyReaders();
    } finally {
      releaseLock();
    }
  };

  const attachReader = async (): Promise<number> => {
    const releaseLock = await lock();
    try {
      const readerId = nextReaderId++;
      readers.set(readerId, {
        lastSeenVersion: initialValue !== undefined ? 0 : version,
        isActive: true
      });

      // If there's a current value, notify immediately
      if (value !== undefined || error !== undefined) {
        notifyReaders();
      }

      return readerId;
    } finally {
      releaseLock();
    }
  };

  const detachReader = async (readerId: number): Promise<void> => {
    const releaseLock = await lock();
    try {
      readers.delete(readerId);
    } finally {
      releaseLock();
    }
  };

  const read = async (readerId: number): Promise<{ value: T | undefined; done: boolean }> => {
    while (true) {
      const releaseLock = await lock();
      let result: { value: T | undefined; done: boolean } | null = null;

      try {
        const reader = readers.get(readerId);
        if (!reader || !reader.isActive) {
          return { value: undefined, done: true };
        }

        if (reader.lastSeenVersion < version) {
          if (error) throw error;

          result = { value, done: false };
          reader.lastSeenVersion = version;
        } else if (isCompleted) {
          return { value: undefined, done: true };
        }
      } finally {
        releaseLock();
      }

      if (result) return result;

      // Wait for next value or completion
      await new Promise<void>(resolve => {
        waitingReaders.push(resolve);
      });
    }
  };

  const peek = async (): Promise<T | undefined> => {
    const releaseLock = await lock();
    try {
      return value;
    } finally {
      releaseLock();
    }
  };

  const complete = async (): Promise<void> => {
    const releaseLock = await lock();
    try {
      isCompleted = true;
      notifyReaders();
    } finally {
      releaseLock();
    }
  };

  return {
    write,
    error: writeError,
    read,
    peek,
    attachReader,
    detachReader,
    complete,
    completed: (readerId: number) => {
      const reader = readers.get(readerId);
      return !reader || !reader.isActive || (isCompleted && reader.lastSeenVersion >= version);
    },
    getValue: peek,
    get value() { return value; }
  };
}

export type ReplayBuffer<T = any> = CyclicBuffer<T> & {
  get buffer(): T[];
};

/**
 * Creates a replay buffer with a specified capacity.
 * This buffer stores a history of values up to its capacity and allows new readers
 * to "replay" past values from the point they attach, up to the current value.
 *
 * If `capacity` is `Infinity`, it acts as an unbounded replay buffer, storing all values.
 * Otherwise, it's a fixed-size circular buffer.
 *
 * @template T The type of items stored in the buffer.
 * @param {number} capacity The maximum number of items the buffer can store. Use `Infinity` for an unbounded buffer.
 * @returns {CyclicBuffer<T>} A replay buffer implementation.
 */
export function createReplayBuffer<T = any>(capacity: number): ReplayBuffer<T> {
  const isInfinite = !isFinite(capacity);
  const buffer: (T | { __error: Error })[] = [];
  let writeIndex = 0;
  let readCount = 0;
  const readerOffsets = new Map<number, { offset: number; detached: boolean }>();
  let readerIdCounter = 0;
  let isCompleted = false;
  let activeReaders = 0;

  const pendingReaders = new Map<number, number>();
  const lock = createLock();
  const writeSemaphore = isInfinite ? undefined : createSemaphore(capacity);
  const readersWaiting = new Map<number, () => void>();

  const notifyReader = (readerId: number) => {
    const notify = readersWaiting.get(readerId);
    if (notify) {
      readersWaiting.delete(readerId);
      notify();
    }
  };

  const notifyWaitingReaders = () => {
    for (const [readerId, reader] of readerOffsets.entries()) {
      if (!reader.detached || reader.offset < readCount) {
        notifyReader(readerId);
      }
    }
  };

  const decrementPendingReader = (index: number) => {
    const current = pendingReaders.get(index) ?? 0;
    const remaining = current - 1;
    if (remaining <= 0) {
      pendingReaders.delete(index);
      if (!isInfinite) {
        writeSemaphore!.release();
      }
    } else {
      pendingReaders.set(index, remaining);
    }
  };

  const hasError = () => buffer.some(i => i && typeof i === "object" && "__error" in i);

  const writeToBuffer = (item: T | { __error: Error }) => {
    if (isInfinite) {
      buffer.push(item);
    } else {
      buffer[writeIndex] = item;
      writeIndex = (writeIndex + 1) % capacity;
    }
    readCount++;
    pendingReaders.set(readCount - 1, activeReaders);
    notifyWaitingReaders();
  };

  const write = async (item: T): Promise<void> => {
    if (isCompleted) throw new Error("Cannot write to completed buffer");
    if (hasError()) throw new Error("Cannot write after error");

    if (!isInfinite && activeReaders > 0 && readCount >= capacity) {
      await writeSemaphore!.acquire();
    }

    const releaseLock = await lock();
    try {
      writeToBuffer(item);
    } finally {
      releaseLock();
    }
  };

  const writeError = async (error: Error): Promise<void> => {
    if (isCompleted) throw new Error("Cannot write error to completed buffer");

    const releaseLock = await lock();
    try {
      writeToBuffer({ __error: error } as any);
    } finally {
      releaseLock();
    }
  };

  const attachReader = async (): Promise<number> => {
    const releaseLock = await lock();
    try {
      const readerId = readerIdCounter++;
      const startPos = Math.max(0, readCount - capacity);
      readerOffsets.set(readerId, { offset: startPos, detached: false });
      activeReaders++;

      if (startPos < readCount) {
        notifyReader(readerId);
      }

      return readerId;
    } finally {
      releaseLock();
    }
  };

  const detachReader = async (readerId: number): Promise<void> => {
    const releaseLock = await lock();
    try {
      const reader = readerOffsets.get(readerId);
      if (!reader) return;

      reader.detached = true;
      activeReaders--;

      for (const [index, count] of pendingReaders) {
        if (count > 0 && reader.offset <= index) {
          decrementPendingReader(index);
        }
      }

      notifyReader(readerId);
    } finally {
      releaseLock();
    }
  };

  const read = async (readerId: number): Promise<{ value: T | undefined; done: boolean }> => {
    while (true) {
      let notify: () => void;
      const waitForValue = new Promise<void>((resolve) => {
        notify = resolve;
      });

      const releaseLock = await lock();
      let result: { value: T | undefined; done: boolean } | null = null;

      try {
        const reader = readerOffsets.get(readerId);
        if (!reader || reader.detached) {
          return { value: undefined, done: true };
        }

        if (reader.offset < readCount) {
          const valueIndex = isInfinite ? reader.offset : reader.offset % capacity;
          const item = buffer[valueIndex];

          if (item && typeof item === "object" && "__error" in item) {
            throw (item as { __error: Error }).__error;
          }

          const value = item as T;
          reader.offset++;

          if (!reader.detached) {
            decrementPendingReader(valueIndex);
          }

          result = { value, done: false };
        } else if (isCompleted) {
          return { value: undefined, done: true };
        } else {
          readersWaiting.set(readerId, notify!);
        }
      } finally {
        releaseLock();
      }

      if (result) return result;
      await waitForValue;

      const reader = readerOffsets.get(readerId);
      if (!reader || reader.detached) {
        return { value: undefined, done: true };
      }
    }
  };

  const peek = async (): Promise<T | undefined> => {
    const releaseLock = await lock();
    try {
      if (readCount === 0) return undefined;
      const latestIndex = isInfinite
        ? buffer.length - 1
        : (writeIndex - 1 + capacity) % capacity;
      const item = buffer[latestIndex];

      if (item && typeof item === "object" && "__error" in item) {
        return undefined;
      }
      return item as T;
    } finally {
      releaseLock();
    }
  };

  const complete = async (): Promise<void> => {
    const releaseLock = await lock();
    try {
      isCompleted = true;
      for (const readerId of readerOffsets.keys()) {
        notifyReader(readerId);
      }
      writeSemaphore?.release();
    } finally {
      releaseLock();
    }
  };

  const completed = (readerId: number): boolean => {
    const reader = readerOffsets.get(readerId);
    if (!reader) return true;
    return isCompleted && reader.offset >= readCount;
  };

  return {
    write,
    error: writeError,
    read,
    peek,
    get buffer() {
      const result: T[] = [];
      const start = isInfinite ? 0 : Math.max(0, readCount - capacity);
      const end = readCount;
      for (let i = start; i < end; i++) {
        const index = isInfinite ? i : i % capacity;
        const item = buffer[index];
        if (item && typeof item === "object" && "__error" in item) continue;
        result.push(item as T);
      }
      return result;
    },
    attachReader,
    detachReader,
    complete,
    completed,
  };
}

