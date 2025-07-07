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

/**
 * A concurrent async buffer allowing multiple readers to consume values independently.
 * Each reader sees only new values written after attachment.
 */
export type CyclicBuffer<T = any> = {
  write(value: T): Promise<void>;
  error(err: Error): Promise<void>;
  read(readerId: number): Promise<IteratorResult<T, void>>;
  peek(): Promise<T | undefined>;
  complete(): Promise<void>;
  attachReader(): Promise<number>;
  detachReader(readerId: number): Promise<void>;
  completed(readerId: number): boolean;
};

/**
 * A simplified buffer variant that stores a single value and delivers it to all readers.
 */
export type SingleValueBuffer<T = any> = CyclicBuffer<T> & {
  getValue(): Promise<T | undefined>;
  get value(): T | undefined;
};

/**
 * Creates a single-value buffer (effectively a buffer with capacity 1).
 * This buffer ensures that a new value can only be written once all currently active readers have consumed the previous value.
 * It provides backpressure by waiting for readers to process the current value before allowing a new one.
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

      // If there's a current value or error, wake up potential readers
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
      const reader = readers.get(readerId);
      if (reader) {
        reader.isActive = false;
        readers.delete(readerId);
      }
    } finally {
      releaseLock();
    }
  };

  const read = async (readerId: number): Promise<IteratorResult<T, void>> => {
    while (true) {
      const releaseLock = await lock();
      let result: IteratorResult<T, void> | null = null;

      try {
        const reader = readers.get(readerId);
        if (!reader || !reader.isActive) {
          return { done: true } as IteratorReturnResult<void>;
        }

        if (reader.lastSeenVersion < version) {
          if (error) {
            throw error;
          }

          result = { value: value as T, done: false };
          reader.lastSeenVersion = version;
        } else if (isCompleted) {
          return { done: true } as IteratorReturnResult<void>;
        }
      } finally {
        releaseLock();
      }

      if (result) {
        return result;
      }

      // Wait for a new value, error, or completion
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
    complete,
    attachReader,
    detachReader,
    completed: (readerId: number) => {
      const reader = readers.get(readerId);
      return !reader || !reader.isActive || (isCompleted && reader.lastSeenVersion >= version);
    },
    getValue: peek,
    get value() {
      return value;
    }
  };
}

/**
 * A buffer that replays a fixed number of the most recent values to new readers.
 *
 * Extends {@link CyclicBuffer} with an additional `buffer` getter
 * to access the internal list of buffered values.
 *
 * @template T The type of values stored in the buffer.
 */
export type ReplayBuffer<T = any> = CyclicBuffer<T> & {
  get buffer(): T[];
};

/**
 * Simple notifier for readers to await new data.
 */
export function createNotifier() {
  let waitingResolvers: (() => void)[] = [];
  return {
    wait: () => new Promise<void>(resolve => waitingResolvers.push(resolve)),
    signal: () => waitingResolvers.shift()?.(),
    signalAll: () => { waitingResolvers.forEach(r => r()); waitingResolvers = []; }
  };
}

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
  let totalWritten = 0;
  let nextReaderId = 0;
  let isCompleted = false;
  let hasError = false;

  type ReaderState = { offset: number };
  const readers = new Map<number, ReaderState>();
  const slotCounters = new Map<number, number>();
  const notifier = createNotifier();

  const lock = createLock();
  const semaphore = isInfinite ? undefined : createSemaphore(capacity);

  // Helper: detect error items
  const isErrorItem = (x: any): x is { __error: Error } => x && typeof x === 'object' && '__error' in x;

  // Map absolute index to circular index
  const getIndex = (abs: number) => isInfinite ? abs : abs % capacity;

  // Release a slot when all readers have consumed it
  const releaseSlot = (abs: number) => {
    const cnt = slotCounters.get(abs);
    if (!cnt) return;
    if (cnt <= 1) {
      slotCounters.delete(abs);
      semaphore?.release();
    } else {
      slotCounters.set(abs, cnt - 1);
    }
  };

  // Write internal without locking
  const writeInternal = (item: T | { __error: Error }) => {
    const abs = totalWritten;
    buffer[getIndex(abs)] = item;
    if (!isInfinite) writeIndex = (writeIndex + 1) % capacity;
    totalWritten++;
    if (readers.size > 0) slotCounters.set(abs, readers.size);
    notifier.signalAll();
  };

  // Public write
  async function write(value: T): Promise<void> {
    const release = await lock();
    try {
      if (isCompleted) throw new Error("Cannot write to completed buffer");
      if (hasError) throw new Error("Cannot write after error");
      if (!isInfinite && totalWritten >= capacity && readers.size > 0) {
        await semaphore!.acquire();
      }
      writeInternal(value);
    } finally {
      release();
    }
  }

  // Public error
  async function error(err: Error): Promise<void> {
    const release = await lock();
    try {
      if (isCompleted) throw new Error("Cannot write error to completed buffer");
      hasError = true;
      writeInternal({ __error: err });
    } finally {
      release();
    }
  }

  // Attach a new reader
  async function attachReader(): Promise<number> {
    const release = await lock();
    try {
      const id = nextReaderId++;
      const start = Math.max(0, totalWritten - (isInfinite ? totalWritten : capacity));
      readers.set(id, { offset: start });
      return id;
    } finally {
      release();
    }
  }

  // Detach a reader, releasing its slots
  async function detachReader(id: number): Promise<void> {
    const release = await lock();
    try {
      const st = readers.get(id);
      if (!st) return;
      const { offset } = st;
      readers.delete(id);
      for (let i = offset; i < totalWritten; i++) releaseSlot(i);
      notifier.signalAll();
    } finally {
      release();
    }
  }

  // Read next value for reader
  async function read(id: number): Promise<IteratorResult<T, void>> {
    while (true) {
      const release = await lock();
      const st = readers.get(id);
      if (!st) { release(); return { value: undefined, done: true }; }
      const off = st.offset;
      if (off < totalWritten) {
        const item = buffer[getIndex(off)];
        st.offset++;
        release();
        if (isErrorItem(item)) throw item.__error;
        releaseSlot(off);
        return { value: item as T, done: false };
      }
      if (isCompleted) { release(); return { value: undefined, done: true }; }
      release();
      await notifier.wait();
    }
  }

  // Complete buffer
  async function complete(): Promise<void> {
    const release = await lock();
    try {
      isCompleted = true;
      notifier.signalAll();
      semaphore?.release();
    } finally {
      release();
    }
  }

  // Peek latest
  async function peek(): Promise<T | undefined> {
    const release = await lock();
    try {
      if (totalWritten === 0) return undefined;
      const idx = isInfinite ? totalWritten - 1 : (writeIndex - 1 + capacity) % capacity;
      const item = buffer[idx];
      return isErrorItem(item) ? undefined : (item as T);
    } finally {
      release();
    }
  }

  // Check completed for reader
  function completed(id: number): boolean {
    const st = readers.get(id);
    return !st || (isCompleted && st.offset >= totalWritten);
  }

  // Snapshot
  function getBuffer(): T[] {
    const res: T[] = [];
    const start = Math.max(0, totalWritten - (isInfinite ? totalWritten : capacity));
    for (let i = start; i < totalWritten; i++) {
      const item = buffer[getIndex(i)];
      if (!isErrorItem(item)) res.push(item as T);
    }
    return res;
  }

  return {
    write,
    error,
    read,
    peek,
    attachReader,
    detachReader,
    complete,
    completed,
    get buffer() { return getBuffer(); }
  };
}
